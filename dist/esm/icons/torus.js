/**
 * @license lucide-vue v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */

import createLucideIcon from '../createLucideIcon.js';

const Torus = createLucideIcon("TorusIcon", [
  ["ellipse", {
    cx: "12",
    cy: "11",
    rx: "3",
    ry: "2"
  }],
  ["ellipse", {
    cx: "12",
    cy: "12.5",
    rx: "10",
    ry: "8.5"
  }]
]);

export { Torus as default };
