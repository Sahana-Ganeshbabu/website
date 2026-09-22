const session = storage.get("mf_session", null);
if (!session?.isLoggedIn) {
  window.location.href = "auth.html";
}

const KEYS = {
  assignments: "mf_assignments",
  requests: "mf_requests",
  payments: "mf_payments"
};

const BASE_DELIVERY = 499;
const EMERGENCY_FEES = { High: 350, Medium: 200, Low: 80 };

let selectedMethod = "UPI";

const assignmentSelect = document.getElementById("assignmentSelect");
const deliveryChargeEl = document.getElementById("deliveryCharge");
const emergencyChargeEl = document.getElementById("emergencyCharge");
const totalAmountEl = document.getElementById("totalAmount");
const paymentStatusChip = document.getElementById("paymentStatusChip");
const invoicePreview = document.getElementById("invoicePreview");
const invoiceList = document.getElementById("invoiceList");
const paymentHistory = document.getElementById("paymentHistory");
const payNowBtn = document.getElementById("payNowBtn");
const payMethods = document.getElementById("payMethods");
const successModal = document.getElementById("successModal");
const successMessage = document.getElementById("successMessage");
const closeModalBtn = document.getElementById("closeModalBtn");
const logoutBtn = document.getElementById("logoutBtn");
const welcomeHeading = document.getElementById("welcomeHeading");

const getAssignments = () => storage.get(KEYS.assignments, []);
const getRequests = () => storage.get(KEYS.requests, []);
const getPayments = () => storage.get(KEYS.payments, []);

function getRequestDetails(assignment) {
  const requests = getRequests();
  const full = requests.find((r) => r.id === assignment.requestRef.id);
  return { ...assignment.requestRef, ...(full || {}) };
}

function calculateCharges(assignment) {
  const request = getRequestDetails(assignment);
  const emergency = EMERGENCY_FEES[request.emergencyLevel] || 120;
  const delivery = BASE_DELIVERY;
  return { delivery, emergency, total: delivery + emergency, request };
}

function isPaid(assignmentId) {
  return getPayments().some((p) => p.assignmentId === assignmentId && p.status === "Paid");
}

function makeInvoiceId() {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

function formatCurrency(amount) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function renderInvoiceCard(assignment, payment, compact) {
  const charges = calculateCharges(assignment);
  const request = charges.request;
  const paid = payment?.status === "Paid";
  const invoiceId = payment?.invoiceId || makeInvoiceId();

  return `
    <article class="invoice-card ${compact ? "" : "reveal"}">
      <div class="invoice-head">
        <div>
          <p class="invoice-id">${invoiceId}</p>
          <strong>${request.hospitalName || "Hospital"}</strong>
        </div>
        <span class="chip ${paid ? "completed" : "pending"}">${paid ? "Paid" : "Unpaid"}</span>
      </div>
      <div class="invoice-lines">
        <p>Drone ID: <strong>${assignment.droneRef.droneId}</strong></p>
        <p>Medicine: <strong>${request.medicine || "—"}</strong> · Qty ${request.quantity || "—"}</p>
        <p>Delivery charges: <strong>${formatCurrency(charges.delivery)}</strong></p>
        <p>Emergency charges: <strong>${formatCurrency(charges.emergency)}</strong></p>
        <p>Total: <strong>${formatCurrency(charges.total)}</strong></p>
        ${payment ? `<p>Method: <strong>${payment.method}</strong> · ${new Date(payment.paidAt).toLocaleString()}</p>` : ""}
      </div>
    </article>
  `;
}

function getSelectedAssignment() {
  const id = assignmentSelect.value;
  return getAssignments().find((a) => a.id === id) || null;
}

function updatePaymentUI() {
  const assignment = getSelectedAssignment();
  if (!assignment) {
    deliveryChargeEl.textContent = "₹0";
    emergencyChargeEl.textContent = "₹0";
    totalAmountEl.textContent = "₹0";
    paymentStatusChip.textContent = "—";
    paymentStatusChip.className = "chip pending";
    invoicePreview.innerHTML = `<p class="section-sub">Select an assignment to preview invoice.</p>`;
    payNowBtn.disabled = true;
    return;
  }

  const charges = calculateCharges(assignment);
  const paid = isPaid(assignment.id);

  deliveryChargeEl.textContent = formatCurrency(charges.delivery);
  emergencyChargeEl.textContent = formatCurrency(charges.emergency);
  totalAmountEl.textContent = formatCurrency(charges.total);
  paymentStatusChip.textContent = paid ? "Paid" : "Unpaid";
  paymentStatusChip.className = `chip ${paid ? "completed" : "pending"}`;

  const existingPayment = getPayments().find((p) => p.assignmentId === assignment.id);
  invoicePreview.innerHTML = renderInvoiceCard(assignment, existingPayment, true);
  payNowBtn.disabled = paid;
  payNowBtn.textContent = paid ? "Already Paid" : "Pay Now";
}

function populateAssignmentSelect() {
  const assignments = getAssignments();
  assignmentSelect.innerHTML = "";

  if (!assignments.length) {
    assignmentSelect.innerHTML = `<option value="">No assignments available</option>`;
    updatePaymentUI();
    return;
  }

  assignments.forEach((assignment) => {
    const request = getRequestDetails(assignment);
    const option = document.createElement("option");
    option.value = assignment.id;
    option.textContent = `${request.hospitalName} · ${request.medicine} (${assignment.droneRef.droneId})`;
    assignmentSelect.appendChild(option);
  });

  updatePaymentUI();
}

function renderInvoiceList() {
  const assignments = getAssignments();
  const payments = getPayments();

  if (!assignments.length) {
    invoiceList.innerHTML = `<div class="empty-state">No delivery invoices yet. Create assignments from the dashboard.</div>`;
    return;
  }

  invoiceList.innerHTML = assignments
    .map((assignment) => {
      const payment = payments.find((p) => p.assignmentId === assignment.id);
      return renderInvoiceCard(assignment, payment, false);
    })
    .join("");
}

function renderPaymentHistory() {
  const payments = getPayments().sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

  if (!payments.length) {
    paymentHistory.innerHTML = `<div class="empty-state">No payments recorded yet.</div>`;
    return;
  }

  paymentHistory.innerHTML = payments
    .map((payment) => {
      const assignment = getAssignments().find((a) => a.id === payment.assignmentId);
      if (!assignment) return "";
      const request = getRequestDetails(assignment);
      return `
        <article class="item">
          <div class="item-head">
            <strong>${payment.invoiceId}</strong>
            <span class="chip completed">${payment.status}</span>
          </div>
          <p>${request.hospitalName} · ${request.medicine} · ${payment.method}</p>
          <p>${formatCurrency(payment.total)} · ${new Date(payment.paidAt).toLocaleString()}</p>
        </article>
      `;
    })
    .join("");
}

function processPayment() {
  const assignment = getSelectedAssignment();
  if (!assignment) {
    showToast("Select a delivery assignment first.", "error");
    return;
  }
  if (isPaid(assignment.id)) {
    showToast("This delivery is already paid.", "error");
    return;
  }

  const charges = calculateCharges(assignment);
  const request = charges.request;
  const payment = {
    id: crypto.randomUUID(),
    invoiceId: makeInvoiceId(),
    assignmentId: assignment.id,
    hospitalName: request.hospitalName,
    droneId: assignment.droneRef.droneId,
    medicine: request.medicine,
    quantity: request.quantity,
    deliveryCharge: charges.delivery,
    emergencyCharge: charges.emergency,
    total: charges.total,
    method: selectedMethod,
    status: "Paid",
    paidAt: new Date().toISOString()
  };

  const payments = getPayments();
  payments.push(payment);
  storage.set(KEYS.payments, payments);

  successMessage.textContent = `${formatCurrency(payment.total)} paid via ${selectedMethod} for ${request.hospitalName}.`;
  successModal.classList.add("show");
  successModal.setAttribute("aria-hidden", "false");

  showToast("Payment successful.", "success");
  updatePaymentUI();
  renderInvoiceList();
  renderPaymentHistory();
}

payMethods?.addEventListener("click", (event) => {
  const btn = event.target.closest(".pay-method");
  if (!btn) return;
  selectedMethod = btn.getAttribute("data-method") || "UPI";
  payMethods.querySelectorAll(".pay-method").forEach((node) => node.classList.remove("selected"));
  btn.classList.add("selected");
});

assignmentSelect?.addEventListener("change", updatePaymentUI);
payNowBtn?.addEventListener("click", processPayment);

closeModalBtn?.addEventListener("click", () => {
  successModal.classList.remove("show");
  successModal.setAttribute("aria-hidden", "true");
});

successModal?.addEventListener("click", (event) => {
  if (event.target === successModal) {
    successModal.classList.remove("show");
    successModal.setAttribute("aria-hidden", "true");
  }
});

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("mf_session");
  showToast("Logged out successfully.", "success");
  setTimeout(() => (window.location.href = "auth.html"), 350);
});

document.addEventListener("DOMContentLoaded", () => {
  welcomeHeading.textContent = `Payment & Invoice · ${session?.email || "Operator"}`;
  populateAssignmentSelect();
  renderInvoiceList();
  renderPaymentHistory();
});
