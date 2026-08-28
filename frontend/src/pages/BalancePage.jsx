import { useEffect, useState } from "react";
import client, { apiErrorMessage } from "../api/client";
import { PAYMENT_METHODS } from "../lib/paymentMethods";
import { CarIcon } from "../components/Icons";

function Avatar({ photoUrl, size = 44 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <CarIcon size={Math.round(size * 0.5)} />
      )}
    </div>
  );
}

export default function BalancePage() {
  const [balances, setBalances] = useState(null);
  const [error, setError] = useState("");
  const [payingId, setPayingId] = useState(null); // counterparty_id currently choosing a payment method
  const [paymentMethod, setPaymentMethod] = useState("venmo");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const { data } = await client.get("/balances");
      setBalances(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't load your balances."));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkPaid = async (balance) => {
    setSubmitting(true);
    setError("");
    try {
      await Promise.all(
        balance.unpaid_ride_ids.map((rideId) =>
          client.post("/reviews", {
            ride_request_id: rideId,
            reviewee_id: balance.counterparty_id,
            paid: true,
            paid_method: paymentMethod,
          })
        )
      );
      setPayingId(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't mark that as paid."));
    } finally {
      setSubmitting(false);
    }
  };

  const totalYouOwe = balances ? balances.filter((b) => b.amount < 0).reduce((sum, b) => sum + Math.abs(b.amount), 0) : 0;
  const totalOwedToYou = balances ? balances.filter((b) => b.amount > 0).reduce((sum, b) => sum + b.amount, 0) : 0;

  return (
    <div className="container" style={{ paddingTop: 36, maxWidth: 680 }}>
      <div className="row" style={{ gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 30 }} aria-hidden>📊</span>
        <h1 style={{ fontSize: 30 }}>Balances</h1>
      </div>
      <p className="muted" style={{ marginBottom: 24 }}>
        Who owes whom, based on completed rides that haven't been marked paid yet.
      </p>

      <div className="row" style={{ gap: 16, marginBottom: 28 }}>
        <div className="card-flat" style={{ flex: 1 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>You owe</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--danger)" }}>${totalYouOwe.toFixed(2)}</div>
        </div>
        <div className="card-flat" style={{ flex: 1 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>You're owed</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--primary-hover)" }}>${totalOwedToYou.toFixed(2)}</div>
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      {balances === null ? (
        <div className="spinner" />
      ) : balances.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>✅</div>
          <h3 style={{ marginBottom: 6 }}>All settled up</h3>
          <p className="muted">No outstanding balances from your completed rides.</p>
        </div>
      ) : (
        <div className="stack">
          {balances.map((b) => {
            const youOwe = b.amount < 0;
            return (
              <div key={b.counterparty_id} className="card-flat">
                <div className="row-between">
                  <div className="row" style={{ gap: 12 }}>
                    <Avatar photoUrl={b.counterparty_photo} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{b.counterparty_name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {youOwe
                          ? `You owe ${b.counterparty_name.split(" ")[0]}`
                          : `${b.counterparty_name.split(" ")[0]} owes you`}
                        {b.unpaid_ride_ids.length > 1 ? ` · ${b.unpaid_ride_ids.length} rides` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: youOwe ? "var(--danger)" : "var(--primary-hover)" }}>
                      ${Math.abs(b.amount).toFixed(2)}
                    </span>
                    {youOwe && (
                      <button className="btn btn-sm btn-primary" onClick={() => setPayingId(b.counterparty_id)}>
                        Mark as paid
                      </button>
                    )}
                  </div>
                </div>

                {payingId === b.counterparty_id && (
                  <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                    <label>How did you pay?</label>
                    <div className="row" style={{ gap: 8 }}>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ flex: 1 }}>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPayingId(null)}
                        style={{ flexShrink: 0 }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleMarkPaid(b)}
                        disabled={submitting}
                        style={{ flexShrink: 0 }}
                      >
                        {submitting ? "Saving…" : "Confirm"}
                      </button>
                    </div>
                    <p className="helper-text">
                      Payments aren't processed here — this just records that you settled up outside the app.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
