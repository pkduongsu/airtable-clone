"use client";

import React from "react";
import Omni from "../icons/Omni";
import GridFour from "../icons/GridFour";
import ArrowUp from "../icons/ArrowUp";
import Table from "../icons/Table";

const templateCards = [
  {
    title: 'Start with Omni',
    description: 'Use AI to build a custom app tailored to your workflow',
    icon: Omni,
    iconColor: 'rgb(221, 4, 168)',
  },
  {
    title: 'Start with templates',
    description: 'Select a template to get started and customize as you go.',
    icon: GridFour,
    iconColor: 'rgb(99, 73, 141)',
  },
  {
    title: 'Quickly upload',
    description: 'Easily migrate your existing projects in just a few minutes.',
    icon: ArrowUp,
    iconColor: 'rgb(13, 127, 120)',
  },
  {
    title: 'Build an app on your own',
    description: 'Start with a blank app and build your ideal workflow.',
    icon: Table,
    iconColor: 'rgb(59, 102, 163)',
  },
];

export function QuickStartCards() {
  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-0.5">
          {templateCards.map((template, index) => (
            <article 
              key={index}
              className="bg-white rounded-[6px] shadow-at-main-nav p-4 cursor-pointer group"
            >
              <div className="flex flex-col gap-0">
                {/* Icon and Title Row */}
                <div className="flex items-center gap-1">
                  <template.icon size={20} color={template.iconColor} className="flex-none" />
                  <h2 className="leading-[19px] text-[#1d1f25] font-[600] text-[15px] ml-2">{template.title}</h2>
                </div>
                <p className="text-[13px] text-gray-500 leading-[1.5] mt-1">
                  {template.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}