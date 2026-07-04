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


"use client";
import React, { useRef, useState } from "react";

const Card = ({ children, className = "" }) => {
  const cardRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0, rotateX: 0, rotateY: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 3D Tilt calculation
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    setPosition({ x, y, rotateX, rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setPosition((prev) => ({ ...prev, rotateX: 0, rotateY: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`glass-card p-8 sm:p-10 relative overflow-visible group ${className}`}
      style={{
        "--mouse-x": `${position.x}px`,
        "--mouse-y": `${position.y}px`,
        transform: isHovered 
          ? `perspective(1000px) rotateX(${position.rotateX}deg) rotateY(${position.rotateY}deg) scale3d(1.01, 1.01, 1.01)` 
          : `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
        transition: isHovered 
          ? "transform 0.1s ease-out" 
          : "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.1), transparent 40%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default Card;
