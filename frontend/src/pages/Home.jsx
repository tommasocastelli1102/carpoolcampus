import { Link } from "react-router-dom";
import { CarIcon, DenyIcon, SteeringWheelIcon } from "../components/Icons";

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
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="row" style={{ gap: 10, marginBottom: 14 }}>
              <span style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                <DenyIcon size={40} />
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CarIcon size={22} />
                </span>
              </span>
              <h2 style={{ fontSize: 24 }}>I don't have a car</h2>
            </div>
            <p className="muted" style={{ marginBottom: 18, fontSize: 16 }}>
              International or no-car students stuck choosing between slow, unreliable public transit
              and rideshare apps that add up fast.
            </p>
            <ul style={{ margin: "0 0 22px", paddingLeft: 18, color: "var(--text-muted)", fontSize: 16, lineHeight: 2 }}>
              <li>
                <strong style={{ color: "var(--text)" }}>Commuting distance:</strong> 2–5 miles to campus, every day
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Public transit:</strong> slow, infrequent, unreliable in bad weather
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Rideshare cost:</strong> ~$20 one-way, ~$40 round trip — every single day
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Finding a ride:</strong> no easy way to meet fellow students already driving your route
              </li>
            </ul>
            <div style={{ marginTop: "auto" }}>
              <Link to="/auth?mode=register&role=rider">
                <button className="btn btn-primary btn-block">Register</button>
              </Link>
              <p className="muted" style={{ fontSize: 13, marginTop: 10, textAlign: "center" }}>
                Get a car later? You can turn on driving from your profile any time.
              </p>
            </div>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="row" style={{ gap: 10, marginBottom: 14 }}>
              <SteeringWheelIcon size={40} />
              <h2 style={{ fontSize: 24 }}>I have a car</h2>
            </div>
            <p className="muted" style={{ marginBottom: 18, fontSize: 16 }}>
              Student drivers already making the commute — usually with 3–4 empty seats — while
              covering the full cost of ownership alone.
            </p>
            <ul style={{ margin: "0 0 22px", paddingLeft: 18, color: "var(--text-muted)", fontSize: 16, lineHeight: 2 }}>
              <li>
                <strong style={{ color: "var(--text)" }}>Gas:</strong> ~$150–200/month for a typical commuter
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Insurance:</strong> ~$250/month
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Parking permit:</strong> ~$340.23/quarter (~$113/month)
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Tickets &amp; fines:</strong> add up on top of all of it
              </li>
            </ul>
            <div style={{ marginTop: "auto" }}>
              <Link to="/auth?mode=register&role=driver">
                <button className="btn btn-primary btn-block">Register</button>
              </Link>
              <p className="muted" style={{ fontSize: 13, marginTop: 10, textAlign: "center" }}>
                Driving isn't permanent — you'll still be able to ride along on days you'd rather not drive.
              </p>
            </div>
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
            Lower costs for riders, real savings for drivers, fewer cars on the road.
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
            <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
              Earn $4+ per ride, or accept an alternative payment instead:
            </p>
            <div className="row" style={{ gap: 8, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 4 }}>
              <PaymentPill icon="💵" label="Cash" />
              <PaymentPill icon="🍺" label="Beer" />
              <PaymentPill icon="☕" label="Coffee" />
              <PaymentPill icon="🎧" label="Aux cord" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container" style={{ marginTop: 8, marginBottom: 56 }}>
        <h2 style={{ textAlign: "center", fontSize: 28, marginBottom: 8 }}>How it works, start to finish</h2>
        <p className="muted" style={{ textAlign: "center", maxWidth: 560, marginInline: "auto", marginBottom: 32 }}>
          Every ride follows the same simple path, from finding someone to commute with to settling
          up afterward.
        </p>
        <div className="how-it-works-grid">
          <HowItWorksStep number={1} icon="🔍" title="Find or offer a ride">
            Browse nearby driver routes and time slots, or — if you have a car — post your own
            availability so riders can find you.
          </HowItWorksStep>
          <HowItWorksStep number={2} icon="✋" title="Request to ride">
            Pick a time slot that works and send a request. It's just a request until the driver
            responds.
          </HowItWorksStep>
          <HowItWorksStep number={3} icon="✅" title="Driver accepts">
            The driver reviews your request and confirms the seat. Once confirmed, you can message
            each other to sort out pickup details.
          </HowItWorksStep>
          <HowItWorksStep number={4} icon="🚗" title="The ride happens">
            Meet up and commute together, just like carpooling with a friend.
          </HowItWorksStep>
          <HowItWorksStep number={5} icon="⭐" title="Rate & record payment">
            Afterward, leave a quick review and log how (or whether) you paid — Venmo, Zelle, cash,
            or something else entirely.
          </HowItWorksStep>
          <HowItWorksStep number={6} icon="📊" title="Your balance updates">
            Anything you haven't marked paid shows up automatically on your{" "}
            <Link to="/balance" style={{ color: "var(--primary-hover)", fontWeight: 600 }}>
              Balances
            </Link>{" "}
            page — a running "who owes whom" for every ride, like a mini Splitwise for your commute.
          </HowItWorksStep>
        </div>
      </section>

      <style>{`
        @media (max-width: 760px) {
          .home-cards { grid-template-columns: 1fr !important; }
        }
        .how-it-works-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 900px) {
          .how-it-works-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .how-it-works-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function HowItWorksStep({ number, icon, title, children }) {
  return (
    <div className="card" style={{ position: "relative" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
          borderRadius: "50%",
          width: 22,
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {number}
      </div>
      <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h3>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

function PaymentPill({ icon, label }) {
  return (
    <span
      className="row"
      style={{
        gap: 6,
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        padding: "7px 12px",
        fontSize: 12.5,
        color: "var(--text)",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </span>
  );
}
