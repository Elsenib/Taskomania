import startupVideo from "../assets/startup-animation.mp4";

// Shown while the very first request to the backend is in flight — most
// often the /auth/me check for a returning session. That request is the
// one that pays for a sleeping Railway service's cold start, so this can
// run for anywhere from under a second to several seconds. The video plays
// through once at its natural length and only loops if the backend still
// hasn't responded by the time it ends (this component unmounts the moment
// loading resolves, so `loop` never runs longer than the wait itself).
export default function StartupAnimation() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <video
        src={startupVideo}
        autoPlay
        loop
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
