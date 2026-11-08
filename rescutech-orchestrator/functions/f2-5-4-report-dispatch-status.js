/*
 * F.2.5.4 Report Dispatch Status — second-level function of F.2.5 Manage Dispatch Orders
 * (Innoslate project 584, second-level IDEF0 of F.2.5).
 *   Mechanism : S.1.5.4 Status Reporting Module
 *   Input     : IO.17 Verified Acknowledgment (internal, from F.2.5.3 over C.11; absent until the team acknowledges)
 *   Output    : IO.9 Dispatch Status (external, to X.2 Emergency Coordinator over C.2)
 *   Requirements: CRD 1.2.2, 1.3.2, 1.4.4 · SR.7   UC.1 step: UC.1.15
 * Contract operation (contracts/api-v1.yaml):
 *   reportDispatchStatus(StatusQuery) -> 200 DispatchStatus
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;

  /**
   * ICOM signature of F.2.5.4. Status is derived only from recorded events, so "acknowledged" cannot appear early (SR.7).
   * @param {string} orderId
   * @param {VerifiedAcknowledgment|null} verifiedAcknowledgment  I  IO.17
   * @returns {DispatchStatus}  O  IO.9
   */
  function report(orderId, verifiedAcknowledgment) {
    return verifiedAcknowledgment
      ? { orderId: orderId, code: 'ACKNOWLEDGED', label: 'Acknowledged by ' + verifiedAcknowledgment.teamName }
      : { orderId: orderId, code: 'AWAITING_ACK', label: 'Issued, awaiting acknowledgment' };
  }

  function create() {
    // Contract: reportDispatchStatus — IO.17 in; IO.9 (external) out.  CRD 1.2.2, 1.4.4 · SR.7
    function reportDispatchStatus(query) {
      return { status: 200, body: report(query.orderId, query.verifiedAcknowledgment) };
    }
    return { reportDispatchStatus: reportDispatchStatus };
  }

  var api = { id: 'F.2.5.4', mechanism: 'S.1.5.4', create: create, report: report };
  if (node) module.exports = api;
  else root.RescuTechF254 = api;
})(this);
