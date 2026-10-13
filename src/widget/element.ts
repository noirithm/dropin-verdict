import { clearConsent, readConsent, saveConsent } from "./consent";
import { initialState, reduce, type WidgetEvent, type WidgetState } from "./machine";
import { STYLES } from "./styles";
import { S } from "./strings";

const SIMPLE_ACTIONS: Record<string, WidgetEvent> = {
  "consent-no": { type: "CONSENT_DECLINED" },
  camera: { type: "CHOOSE_CAMERA" },
  upload: { type: "CHOOSE_UPLOAD" },
  close: { type: "RESET" },
};

function card(title: string, body: string, buttons: string): string {
  return `<section class="card" aria-labelledby="t">
    <h2 id="t" tabindex="-1" data-focus>${title}</h2>
    ${body}
    <div class="row">${buttons}</div>
    <div class="foot">
      <button class="link" type="button" data-action="delete">${S.deleteData}</button>
      <button class="link" type="button" data-action="close">${S.close}</button>
    </div>
  </section>`;
}

const btn = (action: string, label: string, primary = false) =>
  `<button class="btn${primary ? " primary" : ""}" type="button" data-action="${action}">${label}</button>`;

function view(state: WidgetState): string {
  switch (state.name) {
    case "idle":
      return `<button class="btn primary" type="button" data-action="open" data-focus>${S.openButton}</button>`;
    case "consent":
      return card(
        S.consentTitle,
        `<p>${S.consentIntro}</p><ul>${S.consentPoints.map((p) => `<li>${p}</li>`).join("")}</ul><p class="note">${S.consentDisclaimer}</p>`,
        btn("consent-yes", S.agree, true) + btn("consent-no", S.decline),
      );
    case "source":
      return card(
        S.sourceTitle,
        `<p>${S.sourceHint}</p>`,
        btn("camera", S.useCamera, true) + btn("upload", S.uploadPhoto),
      );
    case "capture":
      return card(S.captureTitle, `<p>${S.capturePlaceholder}</p>`, "");
    case "budget_exhausted":
      return card(S.budgetTitle, `<p>${S.budgetBody}</p>`, "");
    default:
      return card(S.captureTitle, `<p>${S.capturePlaceholder}</p>`, "");
  }
}

export class ShadeWiseWidget extends HTMLElement {
  private state: WidgetState = initialState;
  private panel!: HTMLDivElement;
  private live!: HTMLDivElement;
  private firstRender = true;

  connectedCallback(): void {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLES}</style><div class="live" aria-live="polite"></div><div class="panel"></div>`;
    this.live = root.querySelector(".live") as HTMLDivElement;
    this.panel = root.querySelector(".panel") as HTMLDivElement;
    this.panel.addEventListener("click", (e) => this.onClick(e));
    this.render();
  }

  private dispatch(event: WidgetEvent): void {
    this.state = reduce(this.state, event);
    this.render();
  }

  private announce(text: string): void {
    this.live.textContent = "";
    setTimeout(() => {
      this.live.textContent = text;
    }, 50);
  }

  private onClick(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action as string;

    if (action === "open") {
      this.dispatch({ type: "OPEN" });
      if (readConsent()) this.dispatch({ type: "CONSENT_GIVEN" });
    } else if (action === "consent-yes") {
      saveConsent();
      this.dispatch({ type: "CONSENT_GIVEN" });
    } else if (action === "delete") {
      clearConsent();
      this.dispatch({ type: "RESET" });
      this.announce(S.deleted);
    } else if (SIMPLE_ACTIONS[action]) {
      this.dispatch(SIMPLE_ACTIONS[action]);
    }
  }

  private render(): void {
    this.panel.innerHTML = view(this.state);
    if (this.firstRender) {
      this.firstRender = false;
      return;
    }
    this.panel.querySelector<HTMLElement>("[data-focus]")?.focus();
  }
}

if (!customElements.get("shadewise-widget")) {
  customElements.define("shadewise-widget", ShadeWiseWidget);
}
