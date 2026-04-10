// src/components/StoreReportModal.jsx
import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Bar, Line } from "react-chartjs-2";
import "../styles/StoreReportModal.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function StoreReportModal({ orders, onClose }) {
  const [activeTab, setActiveTab] = useState("monthly");
  const [graphType, setGraphType] = useState("line"); // NEW: line or bar toggle

  // ============================================================
  // Helper: generate full date range with missing days filled
  // ============================================================
  const generateDateRangeMap = (orders) => {
    if (!orders.length) return {};

    const sorted = [...orders].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    const start = new Date(sorted[0].created_at);
    const end = new Date();

    const map = {};
    let cursor = new Date(start);

    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      map[key] = { orders: 0, items: 0, revenue: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    return map;
  };

  // ============================================================
  // Aggregation logic (daily + weekly + monthly)
  // ============================================================
  const aggregateData = (orders, period) => {
    let dataMap = {};

    // For lifetime (daily) we want *full date coverage*
    if (period === "lifetime") dataMap = generateDateRangeMap(orders);

    orders.forEach((order) => {
      const date = new Date(order.created_at);

      let key = "";
      if (period === "monthly") key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      else if (period === "weekly") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10);
      } else {
        key = date.toISOString().slice(0, 10); // daily
      }

      if (!dataMap[key]) dataMap[key] = { orders: 0, items: 0, revenue: 0 };

      const items =
        typeof order.items === "string" ? JSON.parse(order.items) : order.items;

      const totalItems = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

      dataMap[key].orders += 1;
      dataMap[key].items += totalItems;
      dataMap[key].revenue += Number(order.total_amount || 0);
    });

    const labels = Object.keys(dataMap).sort();
    const ordersData = labels.map((l) => dataMap[l].orders);
    const itemsData = labels.map((l) => dataMap[l].items);
    const revenueData = labels.map((l) => dataMap[l].revenue);

    return { labels, ordersData, itemsData, revenueData, dataMap };
  };

  const { labels, ordersData, itemsData, revenueData, dataMap } = useMemo(
    () => aggregateData(orders, activeTab),
    [orders, activeTab]
  );

  // ============================================================
  // Excel Export (Fully colored rows + styled header)
  // ============================================================
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const sheetData = labels.map((l) => ({
      Date: l,
      Orders: dataMap[l].orders,
      "Items Sold": dataMap[l].items,
      Revenue: dataMap[l].revenue,
      "Avg Items/Order": (
        dataMap[l].items / (dataMap[l].orders || 1)
      ).toFixed(2),
      "Avg Revenue/Order": (
        dataMap[l].revenue / (dataMap[l].orders || 1)
      ).toFixed(2),
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData, { origin: "A1" });

    ws["!cols"] = [
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
    ];

    const range = XLSX.utils.decode_range(ws["!ref"]);

    // Header: Green background
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (!cell) continue;
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4CAF50" } },
        alignment: { horizontal: "center" },
      };
    }

    // ROW STRIPING: Light grey full background
    for (let R = 1; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (!cell) continue;
        cell.s = {
          fill: {
            fgColor: { rgb: R % 2 === 0 ? "F5F5F5" : "FFFFFF" },
          },
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `store_report_${activeTab}.xlsx`);
  };

  // ============================================================
  // Graph Config (Line OR Bar)
  // ============================================================
  const GraphComponent = graphType === "line" ? Line : Bar;

  const ordersItemsGraph = {
    labels,
    datasets: [
      {
        label: "Orders",
        data: ordersData,
        borderColor: "#4CAF50",
        backgroundColor: "rgba(76,175,80,0.3)",
      },
      {
        label: "Items Sold",
        data: itemsData,
        borderColor: "#2196F3",
        backgroundColor: "rgba(33,150,243,0.3)",
      },
    ],
  };

  const revenueGraph = {
    labels,
    datasets: [
      {
        label: "Revenue (R)",
        data: revenueData,
        borderColor: "#FF9800",
        backgroundColor: "rgba(255,152,0,0.3)",
      },
    ],
  };

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Store Report</h2>

        {/* TAB SWITCHER */}
        <div className="report-tabs">
          {["monthly", "weekly", "lifetime"].map((tab) => (
            <button
              key={tab}
              className={`report-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* GRAPH TOGGLE */}
        <button
          className="export-btn"
          style={{ marginBottom: "1rem", background: "#2196F3" }}
          onClick={() =>
            setGraphType(graphType === "line" ? "bar" : "line")
          }
        >
          Switch to {graphType === "line" ? "Bar" : "Line"} Graph
        </button>

        {/* CHARTS */}
        {labels.length > 1 && (
          <>
            <GraphComponent
              key={`graph-o-${activeTab}`}
              data={ordersItemsGraph}
              options={{
                responsive: true,
                plugins: { legend: { position: "bottom" } },
              }}
            />

            <GraphComponent
              key={`graph-r-${activeTab}`}
              data={revenueGraph}
              options={{
                responsive: true,
                plugins: { legend: { position: "bottom" } },
              }}
            />
          </>
        )}

        <div style={{ marginTop: "1rem" }}>
          <button className="export-btn" onClick={exportToExcel}>
            Download Excel
          </button>
          <button className="close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
