import { prisma } from "../db";
import { AuthError } from "./auth.service";
import type { Project } from "@prisma/client";

export function toPublicProject(project: Project) {
  return {
    id: project.id,
    teamId: project.teamId,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
  };
}

export async function listProjects(teamId: string) {
  return prisma.project.findMany({ where: { teamId }, orderBy: { createdAt: "asc" } });
}

export async function createProject(teamId: string, name: string) {
  const existing = await prisma.project.findUnique({ where: { teamId_name: { teamId, name } } });
  if (existing) {
    throw new AuthError("Bu adda layihə artıq mövcuddur", 409);
  }
  return prisma.project.create({ data: { teamId, name } });
}

async function getProjectInTeam(projectId: string, teamId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.teamId !== teamId) {
    throw new AuthError("Project not found in this team", 404);
  }
  return project;
}

export async function renameProject(projectId: string, teamId: string, name: string) {
  await getProjectInTeam(projectId, teamId);
  const existing = await prisma.project.findUnique({ where: { teamId_name: { teamId, name } } });
  if (existing && existing.id !== projectId) {
    throw new AuthError("Bu adda layihə artıq mövcuddur", 409);
  }
  return prisma.project.update({ where: { id: projectId }, data: { name } });
}

// Tasks tagged with this project just fall back to "no project" (see
// Task.projectId onDelete: SetNull) — deleting a project is organizational
// cleanup, never a reason to touch the tasks themselves.
export async function deleteProject(projectId: string, teamId: string) {
  await getProjectInTeam(projectId, teamId);
  await prisma.project.delete({ where: { id: projectId } });
}

export async function assertProjectInTeam(projectId: string, teamId: string) {
  await getProjectInTeam(projectId, teamId);
}
