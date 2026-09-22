const session = storage.get("mf_session", null);
if (!session?.isLoggedIn) {
  window.location.href = "auth.html";
}

const droneForm = document.getElementById("droneForm");
const requestForm = document.getElementById("requestForm");
const droneList = document.getElementById("droneList");
const requestList = document.getElementById("requestList");
const assignmentList = document.getElementById("assignmentList");
const runMatchBtn = document.getElementById("runMatchBtn");
const totalDrones = document.getElementById("totalDrones");
const activeRequests = document.getElementById("activeRequests");
const completedDeliveries = document.getElementById("completedDeliveries");
const welcomeHeading = document.getElementById("welcomeHeading");
const logoutBtn = document.getElementById("logoutBtn");

const KEYS = {
  drones: "mf_drones",
  requests: "mf_requests",
  assignments: "mf_assignments"
};

const getData = (key) => storage.get(key, []);
const setData = (key, value) => storage.set(key, value);

function emergencyColor(level) {
  if (level === "High") return "assigned";
  if (level === "Medium") return "pending";
  return "completed";
}

function renderStats() {
  const drones = getData(KEYS.drones);
  const requests = getData(KEYS.requests);
  const assignments = getData(KEYS.assignments);
  totalDrones.textContent = String(drones.length);
  activeRequests.textContent = String(requests.filter((request) => request.status !== "Completed").length);
  completedDeliveries.textContent = String(assignments.filter((item) => item.assignmentStatus === "Completed").length);
}

function renderDrones() {
  const drones = getData(KEYS.drones);
  droneList.innerHTML = "";
  if (!drones.length) {
    droneList.innerHTML = `<div class="item"><p>No drones registered yet.</p></div>`;
    return;
  }

  drones.forEach((drone) => {
    const node = document.createElement("article");
    node.className = "item";
    node.innerHTML = `
      <div class="item-head">
        <strong>${drone.ownerName} (${drone.droneId})</strong>
        <span class="chip ${drone.availability === "Available" ? "available" : "unavailable"}">${drone.availability}</span>
      </div>
      <p>Capacity: ${drone.capacity} | Location: ${drone.location}</p>
      <p>Phone: ${drone.phone}</p>
      <div class="item-actions">
        <button class="btn btn-secondary btn-small" data-delete-drone="${drone.id}">Delete</button>
      </div>
    `;
    droneList.appendChild(node);
  });
}

function renderRequests() {
  const requests = getData(KEYS.requests);
  requestList.innerHTML = "";
  if (!requests.length) {
    requestList.innerHTML = `<div class="item"><p>No requests created yet.</p></div>`;
    return;
  }

  requests.forEach((request) => {
    const node = document.createElement("article");
    node.className = "item";
    node.innerHTML = `
      <div class="item-head">
        <strong>${request.hospitalName} - ${request.medicine}</strong>
        <span class="chip ${request.status.toLowerCase()}">${request.status}</span>
      </div>
      <p>Qty: ${request.quantity} | ${request.location}</p>
      <p>Emergency: <span class="chip ${emergencyColor(request.emergencyLevel)}">${request.emergencyLevel}</span></p>
      <div class="item-actions">
        <button class="btn btn-secondary btn-small" data-delete-request="${request.id}">Delete</button>
      </div>
    `;
    requestList.appendChild(node);
  });
}

function renderAssignments() {
  const assignments = getData(KEYS.assignments);
  assignmentList.innerHTML = "";
  if (!assignments.length) {
    assignmentList.innerHTML = `<div class="item"><p>No assignments yet. Run matching to assign deliveries.</p></div>`;
    return;
  }

  assignments.forEach((item) => {
    const node = document.createElement("article");
    node.className = "item";
    const canComplete = item.assignmentStatus === "Assigned";
    node.innerHTML = `
      <div class="item-head">
        <strong>${item.requestRef.medicine} -> ${item.droneRef.droneId}</strong>
        <span class="chip ${item.assignmentStatus.toLowerCase()}">${item.assignmentStatus}</span>
      </div>
      <p>${item.requestRef.hospitalName} (${item.requestRef.location})</p>
      <p>Drone Owner: ${item.droneRef.ownerName}</p>
      <div class="item-actions">
        ${canComplete ? `<button class="btn btn-primary btn-small" data-complete-assignment="${item.id}">Mark Completed</button>` : ""}
        <button class="btn btn-secondary btn-small" data-delete-assignment="${item.id}">Delete</button>
      </div>
    `;
    assignmentList.appendChild(node);
  });
}

function rerenderAll() {
  renderStats();
  renderDrones();
  renderRequests();
  renderAssignments();
}

droneForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const drone = {
    id: crypto.randomUUID(),
    ownerName: document.getElementById("ownerName").value.trim(),
    droneId: document.getElementById("droneId").value.trim(),
    capacity: document.getElementById("droneCapacity").value.trim(),
    location: document.getElementById("droneLocation").value.trim(),
    phone: document.getElementById("ownerPhone").value.trim(),
    availability: document.getElementById("availabilityStatus").value,
    status: "Idle"
  };

  if (!drone.ownerName || !drone.droneId) {
    showToast("Please fill all required drone fields.", "error");
    return;
  }
  const drones = getData(KEYS.drones);
  drones.push(drone);
  setData(KEYS.drones, drones);
  droneForm.reset();
  showToast("Drone registered successfully.", "success");
  rerenderAll();
});

requestForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const request = {
    id: crypto.randomUUID(),
    hospitalName: document.getElementById("hospitalName").value.trim(),
    location: document.getElementById("hospitalLocation").value.trim(),
    medicine: document.getElementById("medicineRequired").value.trim(),
    quantity: document.getElementById("medicineQuantity").value.trim(),
    emergencyLevel: document.getElementById("emergencyLevel").value,
    contact: document.getElementById("hospitalContact").value.trim(),
    status: "Pending",
    createdAt: new Date().toISOString()
  };
  if (!request.hospitalName || !request.medicine) {
    showToast("Please fill all required request fields.", "error");
    return;
  }
  const requests = getData(KEYS.requests);
  requests.push(request);
  setData(KEYS.requests, requests);
  requestForm.reset();
  showToast("Medicine request created.", "success");
  rerenderAll();
});

function runMatching() {
  const drones = getData(KEYS.drones);
  const requests = getData(KEYS.requests);
  const assignments = getData(KEYS.assignments);

  const availableDrones = drones.filter((drone) => drone.availability === "Available");
  const pendingRequests = requests.filter((request) => request.status === "Pending");

  if (!availableDrones.length || !pendingRequests.length) {
    showToast("No available drone or pending request for matching.", "error");
    return;
  }

  let count = 0;
  pendingRequests.forEach((request) => {
    const drone = availableDrones.shift();
    if (!drone) return;
    request.status = "Assigned";
    drone.availability = "Unavailable";
    assignments.push({
      id: crypto.randomUUID(),
      requestRef: {
        id: request.id,
        medicine: request.medicine,
        hospitalName: request.hospitalName,
        location: request.location,
        quantity: request.quantity,
        emergencyLevel: request.emergencyLevel,
        contact: request.contact
      },
      droneRef: { id: drone.id, droneId: drone.droneId, ownerName: drone.ownerName },
      assignmentStatus: "Assigned",
      priorityColor: emergencyColor(request.emergencyLevel),
      assignedAt: new Date().toISOString(),
      completedAt: null
    });
    count += 1;
  });

  setData(KEYS.drones, drones);
  setData(KEYS.requests, requests);
  setData(KEYS.assignments, assignments);
  showToast(`${count} assignment(s) created.`, "success");
  rerenderAll();
}

function completeAssignment(assignmentId) {
  const assignments = getData(KEYS.assignments);
  const requests = getData(KEYS.requests);
  const drones = getData(KEYS.drones);
  const assignment = assignments.find((item) => item.id === assignmentId);
  if (!assignment) return;

  assignment.assignmentStatus = "Completed";
  assignment.completedAt = new Date().toISOString();
  const request = requests.find((item) => item.id === assignment.requestRef.id);
  const drone = drones.find((item) => item.id === assignment.droneRef.id);
  if (request) request.status = "Completed";
  if (drone) drone.availability = "Available";

  setData(KEYS.assignments, assignments);
  setData(KEYS.requests, requests);
  setData(KEYS.drones, drones);
  showToast("Assignment marked completed.", "success");
  rerenderAll();
}

function deleteById(key, id) {
  const data = getData(key).filter((item) => item.id !== id);
  setData(key, data);
}

function cleanupAssignmentsByRelation({ droneId, requestId }) {
  let assignments = getData(KEYS.assignments);
  const drones = getData(KEYS.drones);
  const requests = getData(KEYS.requests);

  const toDelete = assignments.filter((item) => {
    if (droneId) return item.droneRef.id === droneId;
    if (requestId) return item.requestRef.id === requestId;
    return false;
  });

  toDelete.forEach((item) => {
    const request = requests.find((entry) => entry.id === item.requestRef.id);
    const drone = drones.find((entry) => entry.id === item.droneRef.id);
    if (item.assignmentStatus === "Assigned") {
      if (request) request.status = "Pending";
      if (drone) drone.availability = "Available";
    }
  });

  assignments = assignments.filter((item) => !toDelete.includes(item));
  setData(KEYS.assignments, assignments);
  setData(KEYS.requests, requests);
  setData(KEYS.drones, drones);
}

function deleteAssignment(assignmentId) {
  const assignments = getData(KEYS.assignments);
  const requests = getData(KEYS.requests);
  const drones = getData(KEYS.drones);
  const target = assignments.find((item) => item.id === assignmentId);
  if (!target) return;

  if (target.assignmentStatus === "Assigned") {
    const request = requests.find((item) => item.id === target.requestRef.id);
    const drone = drones.find((item) => item.id === target.droneRef.id);
    if (request) request.status = "Pending";
    if (drone) drone.availability = "Available";
    setData(KEYS.requests, requests);
    setData(KEYS.drones, drones);
  }

  setData(
    KEYS.assignments,
    assignments.filter((item) => item.id !== assignmentId)
  );
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const droneId = target.getAttribute("data-delete-drone");
  if (droneId) {
    cleanupAssignmentsByRelation({ droneId });
    deleteById(KEYS.drones, droneId);
    showToast("Drone removed.", "success");
    rerenderAll();
  }

  const requestId = target.getAttribute("data-delete-request");
  if (requestId) {
    cleanupAssignmentsByRelation({ requestId });
    deleteById(KEYS.requests, requestId);
    showToast("Request removed.", "success");
    rerenderAll();
  }

  const assignmentId = target.getAttribute("data-delete-assignment");
  if (assignmentId) {
    deleteAssignment(assignmentId);
    showToast("Assignment removed.", "success");
    rerenderAll();
  }

  const completeId = target.getAttribute("data-complete-assignment");
  if (completeId) {
    completeAssignment(completeId);
  }
});

runMatchBtn?.addEventListener("click", runMatching);

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("mf_session");
  showToast("Logged out successfully.", "success");
  setTimeout(() => (window.location.href = "auth.html"), 350);
});

document.addEventListener("DOMContentLoaded", () => {
  const email = session?.email || "Operator";
  welcomeHeading.textContent = `Welcome, ${email}`;
  rerenderAll();
});
