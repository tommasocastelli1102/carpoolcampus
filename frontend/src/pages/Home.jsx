import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      {/* Banner */}
      <section style={{ padding: "96px 0 64px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(600px 300px at 50% 0%, rgba(45,108,246,0.22), transparent 70%)",
            zIndex: 0,
          }}
        />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 68px)", fontWeight: 800, letterSpacing: "-0.03em" }}>
            Carpool<span style={{ color: "var(--primary-hover)" }}>Campus</span>
          </h1>
          <p className="muted" style={{ fontSize: "clamp(16px, 2.2vw, 22px)", marginTop: 18, maxWidth: 620, marginInline: "auto" }}>
            Commute Together, Share the Ride, Split the Cost.
          </p>
          <div className="row" style={{ justifyContent: "center", marginTop: 32 }}>
            <Link to="/auth">
              <button className="btn btn-primary">Log In / Register</button>
            </Link>
          </div>
        </div>
      </section>

      {/* Value prop cards */}
      <section className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
          className="home-cards"
        >
          <div className="card">
            <div style={{ fontSize: 34, marginBottom: 10 }}>🎒</div>
            <h2 style={{ fontSize: 24, marginBottom: 6 }}>I don't have a car</h2>
            <p className="muted" style={{ marginBottom: 18 }}>
              International or no-car students commuting 2–5 miles to campus, stuck choosing between
              slow, unreliable public transit and rideshare apps that add up fast.
            </p>
            <ul style={{ margin: "0 0 22px", paddingLeft: 18, color: "var(--text-muted)", fontSize: 14, lineHeight: 1.9 }}>
              <li>Public transit: slow, infrequent, unreliable in bad weather</li>
              <li>Uber/Lyft: ~$20 one-way, ~$40 round trip — every single day</li>
              <li>No easy way to meet fellow students already driving your route</li>
            </ul>
            <Link to="/auth?role=rider">
              <button className="btn btn-primary btn-block">Log In / Register as a Rider</button>
            </Link>
          </div>

          <div className="card">
            <div style={{ fontSize: 34, marginBottom: 10 }}>🚗</div>
            <h2 style={{ fontSize: 24, marginBottom: 6 }}>I have a car</h2>
            <p className="muted" style={{ marginBottom: 18 }}>
              Student drivers already making the commute — usually with 3–4 empty seats — while
              covering the full cost of ownership alone.
            </p>
            <ul style={{ margin: "0 0 22px", paddingLeft: 18, color: "var(--text-muted)", fontSize: 14, lineHeight: 1.9 }}>
              <li>Gas: ~$150–200/month for a typical commuter</li>
              <li>Insurance: ~$250/month</li>
              <li>
                UCLA campus commuter parking permit: ~$340.23/quarter (~$113/month) — general UCLA
                Transportation student rate; Anderson doesn't publish a separate figure and routes
                students to this same rate.{" "}
                <a
                  href="https://transportation.ucla.edu/campus-parking/ucla-parking-rates-and-fees"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--primary-hover)" }}
                >
                  Source
                </a>{" "}
                <span style={{ fontSize: 11, opacity: 0.7 }}>(TODO: confirm against latest fiscal-year rate sheet)</span>
              </li>
              <li>Tickets &amp; fines add up on top of all of it</li>
            </ul>
            <Link to="/auth?role=driver">
              <button className="btn btn-primary btn-block">Log In / Register as a Driver</button>
            </Link>
          </div>
        </div>
      </section>

      {/* Value proposition banner */}
      <section className="container" style={{ marginTop: 48 }}>
        <div
          className="card"
          style={{
            background: "linear-gradient(120deg, var(--accent-dark), var(--surface))",
            textAlign: "center",
          }}
        >
          <h3 style={{ fontSize: 22, marginBottom: 10 }}>One empty seat is another student's cheaper, easier commute.</h3>
          <p className="muted" style={{ maxWidth: 640, marginInline: "auto" }}>
            CarpoolCampus turns the ride you're already taking into shared savings — riders pay a
            fraction of rideshare prices, drivers offset real ownership costs, and every filled
            seat means one fewer car on the road to campus.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section className="container" style={{ marginTop: 48, marginBottom: 40 }}>
        <h2 style={{ textAlign: "center", fontSize: 28, marginBottom: 28 }}>Simple, honest pricing</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="home-cards">
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Riders</h3>
            <p className="muted" style={{ marginBottom: 18 }}>Get moving for less than a single rideshare</p>
            <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 6 }}>
              Free <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-muted)" }}>for your first month</span>
            </div>
            <p className="muted" style={{ fontSize: 14 }}>Then $10/month + your shared ride cost, paid directly to your driver.</p>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Drivers</h3>
            <p className="muted" style={{ marginBottom: 18 }}>Turn empty seats into savings</p>
            <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 6 }}>Free to join</div>
            <p className="muted" style={{ fontSize: 14 }}>
              Earn $4+ per ride, or accept an alternative like free beer, coffee, or aux cord privileges.
            </p>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 760px) {
          .home-cards { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
