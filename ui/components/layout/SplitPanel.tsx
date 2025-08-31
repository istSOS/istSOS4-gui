/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useEffect, useRef, useState } from "react";

interface SplitPanelProps {
  leftPanel: React.ReactNode;
  rightPanel?: React.ReactNode;
  showRightPanel?: boolean;
  initialSplit?: number;
}

export const SplitPanel: React.FC<SplitPanelProps> = ({
  leftPanel,
  rightPanel,
  showRightPanel = true,
  initialSplit = 0.5,
}) => {
  const [split, setSplit] = useState(initialSplit);
  const [isSplitting, setIsSplitting] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newSplit = Math.min(Math.max(x / rect.width, 0.15), 0.85);
      setSplit(newSplit);
    };

    const onMouseUp = () => {
      setIsSplitting(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    if (isSplitting) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isSplitting]);

  return (
    <div
      ref={splitRef}
      className="flex flex-row gap-0"
      style={{ 
        height: `calc(100vh - 180px)`, 
        position: "relative", 
        userSelect: isSplitting ? "none" : undefined 
      }}
    >
      <div
        className="h-full overflow-y-auto pr-2"
        style={{
          flexBasis: showRightPanel ? `${split * 100}%` : "100%",
          minWidth: 150,
          maxWidth: "100%",
          transition: isSplitting ? "none" : "flex-basis 0.2s",
        }}
      >
        {leftPanel}
      </div>
      
      {showRightPanel && (
        <>
          <div
            style={{
              width: 4,
              cursor: "col-resize",
              background: "#eee",
              zIndex: 20,
              userSelect: "none",
              borderRadius: "4px",
            }}
            onMouseDown={() => setIsSplitting(true)}
          />
          
          <div className="flex-1 pl-2">
            {rightPanel}
          </div>
        </>
      )}
    </div>
  );
};