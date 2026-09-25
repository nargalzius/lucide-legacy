/**
 * @license lucide-vue v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */

import createLucideIcon from '../createLucideIcon.js';

const ArrowDownCircle = createLucideIcon("ArrowDownCircleIcon", [
  ["circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }],
  ["path", {
    d: "M12 8v8"
  }],
  ["path", {
    d: "m8 12 4 4 4-4"
  }]
]);

export { ArrowDownCircle as default };
