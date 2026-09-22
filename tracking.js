const session = storage.get("mf_session", null);
if (!session?.isLoggedIn) {
  window.location.href = "auth.html";
}

const KEYS = {
  assignments: "mf_assignments",
  requests: "mf_requests",
  drones: "mf_drones"
};

const STAGE_LABELS = [
  "Request Created",
  "Drone Assigned",
  "Pickup Started",
  "In Transit",
  "Delivered"
];

const deliveryCards = document.getElementById("deliveryCards");
const activeCount = document.getElementById("activeCount");
const inTransitCount = document.getElementById("inTransitCount");
const deliveredCount = document.getElementById("deliveredCount");
const logoutBtn = document.getElementById("logoutBtn");
const welcomeHeading = document.getElementById("welcomeHeading");

const getAssignments = () => storage.get(KEYS.assignments, []);
const getRequests = () => storage.get(KEYS.requests, []);

function getRequestDetails(assignment) {
  const requests = getRequests();
  const full = requests.find((r) => r.id === assignment.requestRef.id);
  return { ...assignment.requestRef, ...(full || {}) };
}

function getTrackingState(assignment) {
  if (assignment.assignmentStatus === "Completed") {
    return { stageIndex: 4, progress: 100, etaMin: 0, statusLabel: "Delivered", chipClass: "delivered" };
  }

  const elapsedMin = (Date.now() - new Date(assignment.assignedAt).getTime()) / 60000;
  let stageIndex = 0;
  if (elapsedMin >= 0.3) stageIndex = 1;
  if (elapsedMin >= 1.5) stageIndex = 2;
  if (elapsedMin >= 3) stageIndex = 3;

  const progressMap = [14, 34, 54, 78, 100];
  const etaMin = Math.max(0, 10 - elapsedMin);
  const statusLabel = STAGE_LABELS[stageIndex];
  const chipClass = stageIndex === 3 ? "in-transit" : stageIndex >= 2 ? "assigned" : "pending";

  return { stageIndex, progress: progressMap[stageIndex], etaMin, statusLabel, chipClass };
}

function formatEta(minutes) {
  if (minutes <= 0) return "Arriving now";
  const totalSecs = Math.floor(minutes * 60);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function renderWorkflow(stageIndex) {
  return STAGE_LABELS.map((label, index) => {
    const state = index < stageIndex ? "done" : index === stageIndex ? "active" : "";
    return `
      <div class="workflow-step ${state}">
        <div class="workflow-dot"></div>
        <span>${label}</span>
      </div>
    `;
  }).join("");
}

/** Map positions along the curved route for progress 0–100 */
function getDroneMapPosition(progress) {
  const p = Math.min(100, Math.max(0, progress)) / 100;
  // Approximate points along the SVG cubic path from (12%,70%) to (88%,30%)
  const x = 12 + p * 76;
  const y = 70 - p * 40 + Math.sin(p * Math.PI) * 12;
  return { left: `${x}%`, top: `${y}%` };
}

function renderTrackMap(progress, hospitalName, done, assignmentId) {
  const pos = getDroneMapPosition(progress);
  const pathLength = 1000;
  const dashOffset = pathLength - (pathLength * progress) / 100;
  const shortName = (hospitalName || "Hospital").slice(0, 14);
  const gradId = `routeGrad-${(assignmentId || "x").slice(0, 8)}`;

  return `
    <div class="track-map ${done ? "done" : ""}" data-track-map>
      <div class="track-map-grid"></div>
      <svg class="track-route" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#5b7cfa"/>
            <stop offset="100%" stop-color="#00d4ff"/>
          </linearGradient>
        </defs>
        <path class="track-route-path" d="M 12 70 C 30 70, 35 45, 50 45 S 70 30, 88 30"/>
        <path class="track-route-progress" data-route-progress
          d="M 12 70 C 30 70, 35 45, 50 45 S 70 30, 88 30"
          style="stroke:url(#${gradId});stroke-dashoffset:${dashOffset}"/>
      </svg>
      <div class="track-pin start" style="left:12%;top:70%">
        <div class="track-pin-dot"></div>
        <span class="track-pin-label">Pickup</span>
      </div>
      <div class="track-pin end" style="left:88%;top:30%">
        <div class="track-pin-dot"></div>
        <span class="track-pin-label">${shortName}</span>
      </div>
      <div class="track-drone" data-track-drone style="left:${pos.left};top:${pos.top}">
        <div class="track-pulse"></div>
        <div class="track-drone-body">
          <span class="track-prop tl"></span>
          <span class="track-prop tr"></span>
          <span class="track-prop bl"></span>
          <span class="track-prop br"></span>
          <div class="track-drone-core"></div>
          <div class="track-drone-pack"></div>
        </div>
      </div>
    </div>
  `;
}

function renderDeliveryCard(assignment, isActive) {
  const state = getTrackingState(assignment);
  const request = getRequestDetails(assignment);
  const etaDisplay = state.stageIndex >= 4 ? "Completed" : formatEta(state.etaMin);
  const done = state.stageIndex >= 4;

  return `
    <article class="delivery-card glass reveal ${isActive ? "glow" : ""}" data-assignment="${assignment.id}">
      <div class="item-head">
        <strong>${request.medicine || "Medicine"} · ${request.hospitalName || "Hospital"}</strong>
        <span class="chip ${state.chipClass}">${state.statusLabel}</span>
      </div>
      ${renderTrackMap(state.progress, request.hospitalName, done, assignment.id)}
      <div class="delivery-meta">
        <div class="meta-block">
          <h5>Hospital</h5>
          <p>${request.hospitalName || "—"}</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.2rem">${request.location || "—"}</p>
        </div>
        <div class="meta-block">
          <h5>Assigned Drone</h5>
          <p>${assignment.droneRef.droneId}</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.2rem">${assignment.droneRef.ownerName}</p>
        </div>
        <div class="meta-block">
          <h5>Medicine</h5>
          <p>${request.medicine || "—"}</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.2rem">Qty: ${request.quantity || "—"}</p>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-head">
          <span>Delivery progress</span>
          <strong data-progress-label>${state.progress}%</strong>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${state.progress}%"></div>
        </div>
      </div>
      <div class="item-head" style="margin-top:0.75rem">
        <span class="eta-pill">ETA <span data-eta>${etaDisplay}</span></span>
        <span style="color:var(--text-muted);font-size:0.85rem">ID: ${assignment.id.slice(0, 8)}</span>
      </div>
      <div class="workflow">${renderWorkflow(state.stageIndex)}</div>
    </article>
  `;
}

function updateStats(assignments) {
  const active = assignments.filter((a) => a.assignmentStatus === "Assigned");
  const inTransit = active.filter((a) => getTrackingState(a).stageIndex === 3);
  const deliveredToday = assignments.filter((a) => {
    if (a.assignmentStatus !== "Completed" || !a.completedAt) return false;
    const completed = new Date(a.completedAt);
    const now = new Date();
    return completed.toDateString() === now.toDateString();
  });

  activeCount.textContent = String(active.length);
  inTransitCount.textContent = String(inTransit.length);
  deliveredCount.textContent = String(deliveredToday.length);
}

function renderDeliveries() {
  const assignments = getAssignments().sort(
    (a, b) => new Date(b.assignedAt) - new Date(a.assignedAt)
  );

  updateStats(assignments);

  if (!assignments.length) {
    deliveryCards.innerHTML = `
      <div class="empty-state glass reveal">
        <p>No deliveries yet. Create assignments from the dashboard to start tracking.</p>
        <a href="dashboard.html#assignmentsSection" class="btn btn-primary" style="margin-top:0.75rem;display:inline-flex">Go to Assignments</a>
      </div>
    `;
    return;
  }

  const active = assignments.filter((a) => a.assignmentStatus === "Assigned");
  const completed = assignments.filter((a) => a.assignmentStatus === "Completed");

  deliveryCards.innerHTML = [
    ...active.map((a) => renderDeliveryCard(a, true)),
    ...completed.map((a) => renderDeliveryCard(a, false))
  ].join("");
}

function tickLiveUpdates() {
  document.querySelectorAll("[data-assignment]").forEach((card) => {
    const id = card.getAttribute("data-assignment");
    const assignment = getAssignments().find((a) => a.id === id);
    if (!assignment || assignment.assignmentStatus === "Completed") return;

    const state = getTrackingState(assignment);
    const fill = card.querySelector(".progress-fill");
    const label = card.querySelector("[data-progress-label]");
    const eta = card.querySelector("[data-eta]");
    if (fill) fill.style.width = `${state.progress}%`;
    if (label) label.textContent = `${state.progress}%`;
    if (eta) eta.textContent = formatEta(state.etaMin);

    const drone = card.querySelector("[data-track-drone]");
    if (drone) {
      const pos = getDroneMapPosition(state.progress);
      drone.style.left = pos.left;
      drone.style.top = pos.top;
    }

    const routeProgress = card.querySelector("[data-route-progress]");
    if (routeProgress) {
      const pathLength = 1000;
      routeProgress.style.strokeDashoffset = String(pathLength - (pathLength * state.progress) / 100);
    }

    const workflow = card.querySelector(".workflow");
    if (workflow) workflow.innerHTML = renderWorkflow(state.stageIndex);
  });
  updateStats(getAssignments());
}

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("mf_session");
  showToast("Logged out successfully.", "success");
  setTimeout(() => (window.location.href = "auth.html"), 350);
});

document.addEventListener("DOMContentLoaded", () => {
  welcomeHeading.textContent = `Delivery Tracking · ${session?.email || "Operator"}`;
  renderDeliveries();
  setInterval(tickLiveUpdates, 1000);
});
