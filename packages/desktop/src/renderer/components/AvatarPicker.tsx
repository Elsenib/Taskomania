import { useRef, useState } from "react";
import Avatar from "./Avatar";
import { useT } from "../i18n/useT";

const TARGET_SIZE = 160;

// Resizes+crops to a square JPEG data URI client-side so the payload stored
// on User.avatarUrl stays small (tens of KB, not whatever the original photo
// was) — no server-side image processing needed for something this small.
// Internal failure reasons stay as plain English codes (this isn't a React
// component, so it can't call useT()) — the caller maps any rejection to one
// shared, localized message instead of surfacing these directly.
function resizeToSquareDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.onload = () => {
      img.onerror = () => reject(new Error("image_load_failed"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas_unsupported"));
        ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

interface Props {
  displayName: string;
  avatarUrl: string | null;
  onChange: (dataUri: string) => void;
  disabled?: boolean;
}

export default function AvatarPicker({ displayName, avatarUrl, onChange, disabled }: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const dataUri = await resizeToSquareDataUri(file);
      onChange(dataUri);
    } catch {
      setError(t("settings.avatarProcessFailed"));
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar displayName={displayName} avatarUrl={avatarUrl} size={56} fontSize={20} />
      <div>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {t("settings.pickImage")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {error && <div className="form-error" style={{ marginTop: 6 }}>{error}</div>}
      </div>
    </div>
  );
}
