import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import force from "graphology-layout-force";
import circlepack from "graphology-layout/circlepack";
import random from "graphology-layout/random";
import ForceAtlas2Worker from "graphology-layout-forceatlas2/worker";

import net_graph from "./net_graph.json";

const graph = new Graph();

const BEST_N_EDGES = 25;

net_graph.nodes.forEach((node) => {
  graph.addNode(node.label, {
    value: node.job_count,
    size: Math.log10(node.job_count) / Math.log10(1.9),
    label: `${node.label} (${node.job_count})`,
  });
});

net_graph.edges.forEach((edge) => {
  graph.addEdge(edge.from, edge.to, {
    value: edge.value,
  });
});

graph.forEachNode((node, attr) => {
  const nodeEdges = [];
  graph.forEachNeighbor(node, (neighbor, attr) => {
    graph.findEdge(node, neighbor, (edge, attr) => {
      nodeEdges.push({ neighbor, value: attr.value });
    });
  });
  nodeEdges.sort((a, b) => b.value - a.value);
  nodeEdges.slice(BEST_N_EDGES).forEach((edge) => {
    try {
      graph.dropEdge(node, edge.neighbor);
    } catch (e) {}
  });
});

circlepack.assign(graph, {
  hierarchyAttributes: ["degree", "community"],
  scale: 20,
});

forceAtlas2.assign(graph, {
  iterations: 20,
  settings: {
    barnesHutOptimize: true,
    gravity: 0.0000000001,
    scalingRatio: 10000,
    slowDown: 10,
  },
});

const container = document.getElementById("app");
container.style.height = "90vh";
container.style.width = "100vw";

const renderer = new Sigma(graph, container, {
  minCameraRatio: 0.02,
  maxCameraRatio: 10,
});

function resetAndHighlightNode(nodeId) {
  graph.updateEachNodeAttributes(function (node, attr) {
    if (node === nodeId) {
      return { ...attr, color: "#00f" };
    }
    return { ...attr, color: "#a9a9a9" };
  });
  graph.updateEachEdgeAttributes(function (edge, attr, source, target) {
    if (source === nodeId || target === nodeId) {
      return { ...attr, color: "#f00" };
    }
    return { ...attr, color: "#d3d3d3" };
  });

  const neighborKeys = graph.neighbors(nodeId);
  neighborKeys.forEach((neighbor) => {
    const neighborNode = graph.updateNodeAttribute(
      neighbor,
      "color",
      () => "#f00"
    );
  });
}

renderer.on("clickNode", (e) => {
  const nodeId = e.node;

  resetAndHighlightNode(nodeId);

  renderer.refresh();
});

const inputElem = document.getElementById("input");
const searchBtn = document.getElementById("search-button");
const optionsAreaDiv = document.getElementById("options");

searchBtn.addEventListener("click", () => {
  const input = inputElem.value;
  const nodes_matching_input = [];
  for (let i = 0; i < graph.order; i++) {
    const node = graph.nodes()[i];
    if (node.includes(input)) {
      nodes_matching_input.push(node);
    }
    if (nodes_matching_input.length >= 10) {
      break;
    }
  }

  optionsAreaDiv.innerHTML = "";
  nodes_matching_input.forEach((node) => {
    const nodeBtn = document.createElement("button");
    nodeBtn.innerHTML = node;
    nodeBtn.addEventListener("click", () => {
      resetAndHighlightNode(node);
      renderer.refresh();
    });
    optionsAreaDiv.appendChild(nodeBtn);
  });
});
