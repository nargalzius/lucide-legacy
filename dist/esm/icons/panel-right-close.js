/**
 * @license lucide-vue v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */

import createLucideIcon from '../createLucideIcon.js';

const PanelRightClose = createLucideIcon("PanelRightCloseIcon", [
  ["rect", {
    width: "18",
    height: "18",
    x: "3",
    y: "3",
    rx: "2"
  }],
  ["path", {
    d: "M15 3v18"
  }],
  ["path", {
    d: "m8 9 3 3-3 3"
  }]
]);

export { PanelRightClose as default };
