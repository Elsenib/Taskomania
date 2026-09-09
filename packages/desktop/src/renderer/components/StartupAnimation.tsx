import startupVideo from "../assets/startup-animation.mp4";

// Shown while the very first request to the backend is in flight — most
// often the /auth/me check for a returning session. That request is the
// one that pays for a sleeping Railway service's cold start, so this can
// run for anywhere from under a second to several seconds; it loops
// instead of playing once so it never runs out mid-wait.
export default function StartupAnimation() {
  return (
    <div className="auth-shell">
      <video
        src={startupVideo}
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        }}
      />
    </div>
  );
}
