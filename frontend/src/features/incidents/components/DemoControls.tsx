import type { Channel } from "../../../types/common";
import { HP_IDS } from "../../../data/fixtures/happyPotato";
import {
  resetDemo,
  simulateChickenRecount,
  simulateSupplierReport,
  simulateVerification,
  useRestaurantStore,
} from "../../../services/mock/restaurantStore";

const CHANNELS: Array<[Channel, string]> = [
  ["WHATSAPP", "WhatsApp"],
  ["OUTLOOK", "Outlook"],
  ["TELEGRAM", "Telegram"],
];

/**
 * Local test mode until P1 integration exists. Every action here is labelled
 * SIMULATED and never creates a live-channel record.
 */
export function DemoControls() {
  const { restaurant } = useRestaurantStore();
  const incident = restaurant.incidents.find((i) => i.id === HP_IDS.incident);
  const chickenLot = restaurant.snapshot.ingredientLots.find((l) => l.id === "HP-LOT-CH-001");

  return (
    <details className="p2-demo">
      <summary>
        Demo test mode <span className="p2-demo__hint">Simulated inputs — stands in for P1 until integration</span>
      </summary>
      <div className="p2-demo__body">
        <div className="p2-demo__group">
          <p className="p2-demo__label">Simulated supplier report (locked HP-PO-1042 message)</p>
          <div className="p2-demo__row">
            {CHANNELS.map(([channel, label]) => (
              <button key={channel} type="button" className="p2-btn p2-btn--ghost" onClick={() => simulateSupplierReport(channel, "PENDING")}>
                {label} · unverified
              </button>
            ))}
          </div>
          <div className="p2-demo__row">
            {CHANNELS.map(([channel, label]) => (
              <button key={channel} type="button" className="p2-btn p2-btn--ghost" onClick={() => simulateSupplierReport(channel, "VERIFIED")}>
                {label} · verified sender
              </button>
            ))}
          </div>
        </div>
        <div className="p2-demo__group">
          <p className="p2-demo__label">State changes</p>
          <div className="p2-demo__row">
            <button
              type="button"
              className="p2-btn p2-btn--ghost"
              disabled={incident?.status !== "PENDING_VERIFICATION"}
              onClick={() => incident && simulateVerification(incident.id)}
            >
              Simulate P1 verification
            </button>
            <button
              type="button"
              className="p2-btn p2-btn--ghost"
              disabled={chickenLot?.onHandMilli === 8000}
              onClick={() => simulateChickenRecount(8000)}
            >
              Recount chicken to 8 kg
            </button>
            <button type="button" className="p2-btn p2-btn--ghost" onClick={resetDemo}>
              Reset demo
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
