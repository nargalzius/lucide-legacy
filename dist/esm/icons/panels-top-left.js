/**
 * @license lucide-vue v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */

import createLucideIcon from '../createLucideIcon.js';

const Layout = createLucideIcon("LayoutIcon", [
  ["rect", {
    width: "18",
    height: "18",
    x: "3",
    y: "3",
    rx: "2"
  }],
  ["path", {
    d: "M3 9h18"
  }],
  ["path", {
    d: "M9 21V9"
  }]
]);

export { Layout as default };
