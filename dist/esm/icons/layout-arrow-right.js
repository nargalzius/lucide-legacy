/**
 * @license lucide-vue v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */

import createLucideIcon from '../createLucideIcon.js';

const LayoutArrowRight = createLucideIcon("LayoutArrowRightIcon", [
  ["rect", {
    width: "7",
    height: "7",
    x: "3",
    y: "3",
    rx: "1"
  }],
  ["rect", {
    width: "7",
    height: "7",
    x: "14",
    y: "3",
    rx: "1"
  }],
  ["path", {
    d: "M3 18h18"
  }],
  ["path", {
    d: "m18 21 3-3-3-3"
  }]
]);

export { LayoutArrowRight as default };
