import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Task, Comment, Message, Attachment, TaskDependency, Column, User, Project } from "@team-tracker/shared";
import { getSocket } from "../api/socket";
import { useAuth } from "../auth/AuthContext";
import { wasRecentlyMutatedByMe } from "./useTasks";
import { notify } from "../lib/notify";
import { useUiStore } from "../store/uiStore";

// Patches the React Query cache in place when another team member's app
// broadcasts a change over the socket. REST + its own onSuccess already
// updates the sender's own cache, so every handler here is dedup-safe (an
// id already present is left alone) to avoid double-adding on your own echo.
export function useRealtimeSync(teamId: string) {
  const queryClient = useQueryClient();
  const { user, logout, switchTeam } = useAuth();
  const openTask = useUiStore((s) => s.openTask);
  const openChat = useUiStore((s) => s.openChat);
  const chatOpen = useUiStore((s) => s.chatOpen);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    const tasksOf = () => queryClient.getQueryData<{ tasks: Task[] }>(["tasks", teamId])?.tasks ?? [];

    // The graph view fetches everything in one shot — rather than hand-patch
    // its nested {tasks, members, attachments, dependencies} shape from five
    // different event types, just invalidate it and let it re-fetch. Cheap
    // for a small team's data, and far less error-prone than partial patches.
    const invalidateGraph = () => queryClient.invalidateQueries({ queryKey: ["graph", teamId] });

    // Adding a column can shift every sibling's `order` (see teams.routes.ts),
    // so a full re-fetch is simpler and safer than patching order values by hand.
    const onColumnCreated = (_column: Column) => {
      queryClient.invalidateQueries({ queryKey: ["columns", teamId] });
      invalidateGraph();
    };

    const onColumnReordered = (_columns: Column[]) => {
      queryClient.invalidateQueries({ queryKey: ["columns", teamId] });
      invalidateGraph();
    };

    const onColumnRenamed = (_column: Column) => {
      queryClient.invalidateQueries({ queryKey: ["columns", teamId] });
      invalidateGraph();
    };

    const onProjectCreated = (project: Project) => {
      queryClient.setQueryData<{ projects: Project[] }>(["projects", teamId], (old) => {
        if (!old) return old;
        if (old.projects.some((p) => p.id === project.id)) return old;
        return { projects: [...old.projects, project] };
      });
    };

    const onProjectRenamed = (project: Project) => {
      queryClient.setQueryData<{ projects: Project[] }>(["projects", teamId], (old) => {
        if (!old) return old;
        return { projects: old.projects.map((p) => (p.id === project.id ? project : p)) };
      });
    };

    const onProjectDeleted = ({ id }: { id: string }) => {
      queryClient.setQueryData<{ projects: Project[] }>(["projects", teamId], (old) => {
        if (!old) return old;
        return { projects: old.projects.filter((p) => p.id !== id) };
      });
      // Tasks tagged with the deleted project fall back to unlabeled server-side.
      queryClient.invalidateQueries({ queryKey: ["tasks", teamId] });
    };

    const onMemberUpdated = (member: User) => {
      queryClient.setQueryData<{ members: User[] }>(["members", teamId], (old) => {
        if (!old) return old;
        return { members: old.members.map((m) => (m.id === member.id ? member : m)) };
      });

      // The JWT itself still carries whatever role was true when it was
      // issued — a role change (mentor promotion/demotion) only actually
      // takes effect for the AFFECTED user once they get a new token.
      // switchTeam(teamId) mints one from the current DB role even when
      // "switching" to the team you're already in, so reuse it here as a
      // silent self-refresh rather than requiring a re-login for the new
      // permissions (e.g. seeing the activity log) to actually apply.
      if (member.id === user.id && member.role !== user.role) {
        switchTeam(teamId).catch(() => {});
      }
    };

    const onTaskCreated = (task: Task) => {
      queryClient.setQueryData<{ tasks: Task[] }>(["tasks", teamId], (old) => {
        if (!old) return old;
        if (old.tasks.some((t) => t.id === task.id)) return old;
        return { tasks: [...old.tasks, task] };
      });
      invalidateGraph();

      if (task.assigneeId === user.id && task.createdById !== user.id) {
        notify("Yeni tapşırıq təyin olundu", task.title, () => openTask(task.id));
      }
    };

    const onTaskUpdated = (task: Task) => {
      const previous = tasksOf().find((t) => t.id === task.id);
      queryClient.setQueryData<{ tasks: Task[] }>(["tasks", teamId], (old) => {
        if (!old) return old;
        return { tasks: old.tasks.map((t) => (t.id === task.id ? task : t)) };
      });
      invalidateGraph();
      if (previous && previous.columnId !== task.columnId) {
        queryClient.invalidateQueries({ queryKey: ["taskActivity", task.id] });
      }

      const assignedToMeJustNow = task.assigneeId === user.id && previous?.assigneeId !== user.id;
      if (assignedToMeJustNow && !wasRecentlyMutatedByMe(task.id)) {
        notify("Tapşırıq sənə təyin olundu", task.title, () => openTask(task.id));
      }
    };

    const onTaskDeleted = ({ id }: { id: string }) => {
      queryClient.setQueryData<{ tasks: Task[] }>(["tasks", teamId], (old) => {
        if (!old) return old;
        return { tasks: old.tasks.filter((t) => t.id !== id) };
      });
      invalidateGraph();
    };

    const onCommentCreated = (comment: Comment) => {
      queryClient.setQueryData<{ comments: Comment[] }>(["comments", comment.taskId], (old) => {
        if (!old) return old; // that task's modal isn't open anywhere on this client — nothing to patch
        if (old.comments.some((c) => c.id === comment.id)) return old;
        return { comments: [...old.comments, comment] };
      });

      if (comment.authorId === user.id) return;
      const task = tasksOf().find((t) => t.id === comment.taskId);
      if (task && (task.assigneeId === user.id || task.createdById === user.id)) {
        notify(`Yeni şərh: ${task.title}`, comment.body, () => openTask(task.id));
      }
    };

    const onMessageCreated = (message: Message) => {
      queryClient.setQueryData<{ messages: Message[] }>(["messages", message.teamId], (old) => {
        if (!old) return old;
        if (old.messages.some((m) => m.id === message.id)) return old;
        return { messages: [...old.messages, message] };
      });

      if (message.authorId === user.id) return;
      if (!chatOpen) {
        notify("Yeni mesaj", message.body, () => openChat());
      }
    };

    const onAttachmentCreated = (attachment: Attachment) => {
      queryClient.setQueryData<{ attachments: Attachment[] }>(
        ["attachments", attachment.taskId],
        (old) => {
          if (!old) return old;
          if (old.attachments.some((a) => a.id === attachment.id)) return old;
          return { attachments: [...old.attachments, attachment] };
        }
      );
      invalidateGraph();
      queryClient.invalidateQueries({ queryKey: ["teamAttachments", teamId] });
    };

    const onAttachmentDeleted = ({ id, taskId }: { id: string; taskId: string }) => {
      queryClient.setQueryData<{ attachments: Attachment[] }>(["attachments", taskId], (old) => {
        if (!old) return old;
        return { attachments: old.attachments.filter((a) => a.id !== id) };
      });
      invalidateGraph();
      queryClient.invalidateQueries({ queryKey: ["teamAttachments", teamId] });
    };

    const onDependencyCreated = (dep: TaskDependency) => {
      for (const taskId of [dep.blockingTaskId, dep.blockedTaskId]) {
        queryClient.setQueryData<{ dependencies: TaskDependency[] }>(
          ["dependencies", taskId],
          (old) => {
            if (!old) return old;
            if (old.dependencies.some((d) => d.id === dep.id)) return old;
            return { dependencies: [...old.dependencies, dep] };
          }
        );
      }
      invalidateGraph();
    };

    const onDependencyDeleted = ({
      id,
      blockingTaskId,
      blockedTaskId,
    }: {
      id: string;
      blockingTaskId: string;
      blockedTaskId: string;
    }) => {
      for (const taskId of [blockingTaskId, blockedTaskId]) {
        queryClient.setQueryData<{ dependencies: TaskDependency[] }>(
          ["dependencies", taskId],
          (old) => {
            if (!old) return old;
            return { dependencies: old.dependencies.filter((d) => d.id !== id) };
          }
        );
      }
      invalidateGraph();
    };

    // Unlike leaving a team (silent — the leaver's own client already knows,
    // everyone else finds out on next refetch), a whole-team delete has to
    // be pushed to every other connected client immediately: their board
    // just stopped existing out from under them. Simplest safe reaction —
    // rather than trying to silently re-target one of the user's other
    // teams — is a full logout back to the login screen, same as an
    // expired-session kick.
    const onTeamDeleted = ({ teamId: deletedTeamId }: { teamId: string }) => {
      if (deletedTeamId !== teamId) return;
      notify("Komanda silindi", "Bu komanda admin tərəfindən silindi.", () => {});
      logout();
    };

    socket.on("column:created", onColumnCreated);
    socket.on("column:reordered", onColumnReordered);
    socket.on("column:renamed", onColumnRenamed);
    socket.on("project:created", onProjectCreated);
    socket.on("project:renamed", onProjectRenamed);
    socket.on("project:deleted", onProjectDeleted);
    socket.on("member:updated", onMemberUpdated);
    socket.on("task:created", onTaskCreated);
    socket.on("task:updated", onTaskUpdated);
    socket.on("task:deleted", onTaskDeleted);
    socket.on("comment:created", onCommentCreated);
    socket.on("message:created", onMessageCreated);
    socket.on("attachment:created", onAttachmentCreated);
    socket.on("attachment:deleted", onAttachmentDeleted);
    socket.on("dependency:created", onDependencyCreated);
    socket.on("dependency:deleted", onDependencyDeleted);
    socket.on("team:deleted", onTeamDeleted);

    return () => {
      socket.off("column:created", onColumnCreated);
      socket.off("column:reordered", onColumnReordered);
      socket.off("column:renamed", onColumnRenamed);
      socket.off("project:created", onProjectCreated);
      socket.off("project:renamed", onProjectRenamed);
      socket.off("project:deleted", onProjectDeleted);
      socket.off("member:updated", onMemberUpdated);
      socket.off("task:created", onTaskCreated);
      socket.off("task:updated", onTaskUpdated);
      socket.off("task:deleted", onTaskDeleted);
      socket.off("comment:created", onCommentCreated);
      socket.off("message:created", onMessageCreated);
      socket.off("attachment:created", onAttachmentCreated);
      socket.off("attachment:deleted", onAttachmentDeleted);
      socket.off("dependency:created", onDependencyCreated);
      socket.off("dependency:deleted", onDependencyDeleted);
      socket.off("team:deleted", onTeamDeleted);
    };
  }, [teamId, queryClient, user, openTask, logout, switchTeam, openChat, chatOpen]);
}
