/**
 * @license lucide-vue v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */

import createLucideIcon from '../createLucideIcon.js';

const CircleEllipsis = createLucideIcon("CircleEllipsisIcon", [
  ["circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }],
  ["path", {
    d: "M17 12h.01"
  }],
  ["path", {
    d: "M12 12h.01"
  }],
  ["path", {
    d: "M7 12h.01"
  }]
]);

export { CircleEllipsis as default };
