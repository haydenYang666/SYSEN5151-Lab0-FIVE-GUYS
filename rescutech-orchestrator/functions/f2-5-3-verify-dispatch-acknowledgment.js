/*
 * F.2.5.3 Verify Dispatch Acknowledgment — second-level function of F.2.5 Manage Dispatch Orders
 * (Innoslate project 584, second-level IDEF0 of F.2.5).
 *   Mechanism : S.1.5.3 Acknowledgment Verification Module
 *   Inputs    : IO.8 Dispatch Acknowledgment (external, from X.3 Rescue Team over C.3)
 *               IO.16 Issued Order Record (internal, from F.2.5.2 over C.10)
 *   Output    : IO.17 Verified Acknowledgment (internal, to F.2.5.4 over C.11)
 *   Requirements: CRD 1.1.3, 1.3.3, 1.4.3, 2.2.2 (planned), 2.4.1, 2.4.2 · SR.9   UC.1 steps: UC.1.13, UC.1.14
 * Contract operation (contracts/api-v1.yaml):
 *   verifyDispatchAcknowledgment(AcknowledgmentCheck) -> 201 VerifiedAcknowledgment | 404 Error | 409 Error
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Common = node ? require('./common.js') : root.RescuTechCommon;

  /**
   * ICOM signature of F.2.5.3.
   * @param {DispatchAcknowledgment} dispatchAcknowledgment  I  IO.8
   * @param {IssuedOrderRecord}      issuedOrderRecord       I  IO.16
   * @param {string} acknowledgedAt  time the acknowledgment is recorded
   * @returns {VerifiedAcknowledgment|null}  O  IO.17 — null when the sender is not the assigned team (CRD 2.4.2)
   */
  function verify(dispatchAcknowledgment, issuedOrderRecord, acknowledgedAt) {
    if (!issuedOrderRecord || dispatchAcknowledgment.orderId !== issuedOrderRecord.orderId) return null;
    if (dispatchAcknowledgment.teamId !== issuedOrderRecord.teamId) return null;
    return { orderId: issuedOrderRecord.orderId, teamId: issuedOrderRecord.teamId,
             teamName: issuedOrderRecord.teamName, acknowledgedAt: acknowledgedAt };
  }

  function create(ctx) {
    var verified = {};

    // Contract: verifyDispatchAcknowledgment — IO.8 (external) and IO.16 in; IO.17 out.  CRD 1.4.3, 2.4.1, 2.4.2 · SR.9
    function verifyDispatchAcknowledgment(check) {
      var ack = check.dispatchAcknowledgment, rec = check.issuedOrderRecord;
      if (!rec) return { status: 404, body: { error: 'Unknown dispatch order ' + ack.orderId + '.', rule: 'SR.9' } };
      if (verified[rec.orderId]) return { status: 201, body: verified[rec.orderId] };          // repeated acknowledgment: same record
      var out = verify(ack, rec, Common.iso(ctx.now()));
      if (!out) {
        ctx.log('UC.1.13', 'Rescue Team', 'Rejected: acknowledgment from ' + ack.teamId + ' does not match the assigned team.', ['SR.9'], 'block');
        return { status: 409, body: { error: 'This order is assigned to a different team.', rule: '2.4.2' } };
      }
      ctx.log('UC.1.13', 'Rescue Team', out.teamName + ' acknowledged receipt of ' + out.orderId + '.', ['SR.9', 'N.6']);
      verified[out.orderId] = out;                                                              // CRD 2.4.1: recorded against its order
      ctx.log('UC.1.14', 'RescuTech', 'Acknowledgment recorded against ' + out.orderId + '.', ['SR.9']);
      return { status: 201, body: out };
    }

    return { verified: verified, verifyDispatchAcknowledgment: verifyDispatchAcknowledgment };
  }

  var api = { id: 'F.2.5.3', mechanism: 'S.1.5.3', create: create, verify: verify };
  if (node) module.exports = api;
  else root.RescuTechF253 = api;
})(this);
