/*  Gel-Calculator - Personalized fuel calculator for endurance athletes.
    Copyright (C) 2026  Eike Christian Karbe

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>. */

import { Github } from "lucide-react";
import StravaIcon from "./StravaIcon";

const Footer = () => (
  <footer className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 pt-6 flex flex-col items-center justify-center gap-4 text-text-secondary border-t border-card-border mt-4">
    <p className="text-sm font-medium">By Eike Christian Karbe</p>
    <div className="flex gap-4">
      <a
        href="https://www.strava.com/athletes/58442765"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-[#fc4c02] transition-colors"
        aria-label="Strava"
      >
        <StravaIcon size={20} />
      </a>
      <a
        href="https://github.com/ekarbe"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-text-primary transition-colors"
        aria-label="GitHub"
      >
        <Github size={20} />
      </a>
    </div>
  </footer>
);

export default Footer;
