'use strict';
/* Merge the parts into one Alpine component. Getters are preserved. */
function app() {
  const out = {};
  [partCore(), partWorker(), partRoles()].forEach((p) => Object.defineProperties(out, Object.getOwnPropertyDescriptors(p)));
  const origInit = out.init;
  out.init = function () {
    origInit.call(this);
    this.onbReset(); this.afInit('');
    this.$nextTick(() => {
      // Keep the signed-in demo worker valid after refresh or reset
      if (this.session.workerId && !this.wk(this.session.workerId)) this.session.workerId = null;
    });
  };
  return out;
}
