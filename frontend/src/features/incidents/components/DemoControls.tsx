import { useState } from "react";
import type { Channel } from "../../../types/common";
import { HP_IDS } from "../../../data/fixtures/happyPotato";
import {
  assessImpactAction,
  resetDemo,
  simulateChickenRecount,
  simulateSupplierReport,
  simulateVerification,
  useRestaurantStore,
} from "../../../services/mock/restaurantStore";
import { impactStateOf } from "../model";

export function DemoControls() {
  const { restaurant } = useRestaurantStore();
  const [channel, setChannel] = useState<Channel>("WHATSAPP");
  const incident = restaurant.incidents.find((item) => item.id === HP_IDS.incident);
  const chickenLot = restaurant.snapshot.ingredientLots.find((lot) => lot.id === "HP-LOT-CH-001");
  const impactState = incident ? impactStateOf(restaurant, incident) : null;

  let step;
  if (!incident) {
    step = {
      hint: "A supplier says today’s chicken delivery won’t arrive.",
      label: "Simulate supplier report",
      run: () => simulateSupplierReport(channel, "PENDING"),
    };
  } else if (incident.status === "PENDING_VERIFICATION") {
    step = {
      hint: "The report is waiting for sender and purchase order verification.",
      label: "Verify report",
      run: () => simulateVerification(incident.id),
    };
  } else if (impactState === "NOT_ASSESSED" || impactState === "STALE") {
    step = {
      hint: impactState === "STALE"
        ? "Stock changed. Update the impact to see which orders are at risk."
        : "The report is verified. Check what the missed delivery means for stock, menus and orders.",
      label: impactState === "STALE" ? "Update impact" : "Assess impact",
      run: () => assessImpactAction(incident.id),
    };
  }

  return (
    <details className="p2-demo">
      <summary>Supplier disruption demo</summary>
      <div className="p2-demo__body">
        <p role="status">{step?.hint ?? (impactState === "UNKNOWN"
          ? "The assessment couldn’t determine the impact. See Impact Explorer for details."
          : "Assessment complete. See the stock, menu and order impact in Impact Explorer.")}</p>
        <div className="p2-demo__row">
          {step && <button type="button" className="p2-btn p2-btn--primary" onClick={step.run}>{step.label}</button>}
          {(incident || restaurant.snapshot.revision > 1) && (
            <button type="button" className="p2-btn p2-btn--ghost" onClick={resetDemo}>Reset demo</button>
          )}
        </div>
        <details className="p2-demo__options">
          <summary>More demo options</summary>
          <div className="p2-demo__row">
            <label className="p2-demo__channel">
              Message channel
              <select className="p2-select" value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="OUTLOOK">Outlook</option>
                <option value="TELEGRAM">Telegram</option>
              </select>
            </label>
            {incident && (
              <button type="button" className="p2-btn p2-btn--ghost" onClick={() => simulateSupplierReport(channel, "PENDING")}>
                Add another report
              </button>
            )}
            {(!incident || incident.status === "PENDING_VERIFICATION") && (
              <button type="button" className="p2-btn p2-btn--ghost" onClick={() => simulateSupplierReport(channel, "VERIFIED")}>
                Add verified report
              </button>
            )}
            <button
              type="button"
              className="p2-btn p2-btn--ghost"
              disabled={chickenLot?.onHandMilli === 8000}
              onClick={() => simulateChickenRecount(8000)}
            >
              Recount chicken to 8 kg
            </button>
          </div>
          <p className="p2-demo__snapshot">Synthetic snapshot <span>{restaurant.snapshot.id} · r{restaurant.snapshot.revision}</span></p>
        </details>
      </div>
    </details>
  );
}
