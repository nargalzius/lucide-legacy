/**
 * @license lucide-vue v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */

import createLucideIcon from '../createLucideIcon.js';

const Grid2X2 = createLucideIcon("Grid2X2Icon", [
  ["path", {
    d: "M12 3v18"
  }],
  ["path", {
    d: "M3 12h18"
  }],
  ["rect", {
    x: "3",
    y: "3",
    width: "18",
    height: "18",
    rx: "2"
  }]
]);

export { Grid2X2 as default };
