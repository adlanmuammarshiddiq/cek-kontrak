"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  BarChart3,
  LogOut,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  status: string;
  regulation?: string;
  teks?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export default function GraphPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedRegulation, setSelectedRegulation] = useState("all");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const nodesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; node: GraphNode }>>([]);
  const edgesRef = useRef<GraphEdge[]>([]);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push("/login");
    } else {
      setIsLoggedIn(true);
    }
  }, [router]);

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const regulation = selectedRegulation === "all" ? undefined : selectedRegulation;
      const data = await api.graph.getData(regulation);
      setGraphData(data);
      setSelectedNode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setIsLoading(false);
    }
  }, [selectedRegulation]);

  useEffect(() => {
    if (isLoggedIn) {
      loadGraph();
    }
  }, [isLoggedIn, loadGraph]);

  // Physics simulation for force-directed graph
  useEffect(() => {
    if (!graphData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Initialize node positions
    nodesRef.current = graphData.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / graphData.nodes.length;
      const radius = Math.min(width, height) * 0.3;
      return {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        node,
      };
    });

    edgesRef.current = graphData.edges;

    const simulate = () => {
      // Apply forces
      const alpha = 0.1;

      // Repulsion between nodes
      for (let i = 0; i < nodesRef.current.length; i++) {
        for (let j = i + 1; j < nodesRef.current.length; j++) {
          const dx = nodesRef.current[j].x - nodesRef.current[i].x;
          const dy = nodesRef.current[j].y - nodesRef.current[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1000 / (dist * dist);

          nodesRef.current[i].vx -= (dx / dist) * force * alpha;
          nodesRef.current[i].vy -= (dy / dist) * force * alpha;
          nodesRef.current[j].vx += (dx / dist) * force * alpha;
          nodesRef.current[j].vy += (dy / dist) * force * alpha;
        }
      }

      // Attraction along edges
      for (const edge of edgesRef.current) {
        const source = nodesRef.current.findIndex((n) => n.node.id === edge.source);
        const target = nodesRef.current.findIndex((n) => n.node.id === edge.target);
        if (source === -1 || target === -1) continue;

        const dx = nodesRef.current[target].x - nodesRef.current[source].x;
        const dy = nodesRef.current[target].y - nodesRef.current[source].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.01 * alpha;

        nodesRef.current[source].vx += (dx / dist) * force;
        nodesRef.current[source].vy += (dy / dist) * force;
        nodesRef.current[target].vx -= (dx / dist) * force;
        nodesRef.current[target].vy -= (dy / dist) * force;
      }

      // Center gravity
      for (const node of nodesRef.current) {
        node.vx += (width / 2 - node.x) * 0.001 * alpha;
        node.vy += (height / 2 - node.y) * 0.001 * alpha;
      }

      // Apply velocity
      for (const node of nodesRef.current) {
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.9;
        node.vy *= 0.9;
      }

      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [graphData]);

  // Draw graph
  useEffect(() => {
    if (!canvasRef.current || !graphData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw edges
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    for (const edge of edgesRef.current) {
      const source = nodesRef.current.find((n) => n.node.id === edge.source);
      const target = nodesRef.current.find((n) => n.node.id === edge.target);
      if (!source || !target) continue;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }

    // Draw nodes
    for (const { x, y, node } of nodesRef.current) {
      const isSelected = selectedNode?.id === node.id;
      const radius = isSelected ? 12 : 8;

      // Node color based on status
      let color = "#3b82f6"; // blue - default
      if (node.status === "aktif") color = "#22c55e"; // green
      if (node.status === "direvisi") color = "#eab308"; // yellow
      if (node.status === "dicabut") color = "#ef4444"; // red

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#1e40af" : "#1e293b";
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#1e293b";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(node.label, x, y + radius + 12);
    }
  }, [selectedNode, graphData]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !graphData) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const node of nodesRef.current) {
      const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (dist < 15) {
        setSelectedNode(node.node);
        return;
      }
    }
    setSelectedNode(null);
  };

  const handleLogout = () => {
    api.auth.logout();
    router.push("/login");
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Check Kontrak</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Graph Peraturan</h1>
          <p className="text-muted-foreground">
            Visualisasi hubungan antar pasal dalam PP 35/2021 dan regulasi terkait
          </p>
        </div>

        {/* Regulation Filter */}
        <div className="mb-4">
          <Tabs value={selectedRegulation} onValueChange={setSelectedRegulation}>
            <TabsList>
              <TabsTrigger value="all">Semua</TabsTrigger>
              <TabsTrigger value="PP 35/2021">PP 35/2021</TabsTrigger>
              <TabsTrigger value="PP 36/2021">PP 36/2021</TabsTrigger>
              <TabsTrigger value="UU 13/2003">UU 13/2003</TabsTrigger>
              <TabsTrigger value="UU 6/2023">UU 6/2023</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Graph Canvas */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Visualisasi Graph</CardTitle>
              <CardDescription>
                Klik node untuk melihat detail pasal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[500px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="h-[500px] flex items-center justify-center text-destructive">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  {error}
                </div>
              ) : (
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={700}
                    height={500}
                    className="w-full border rounded-lg bg-white cursor-pointer"
                    onClick={handleCanvasClick}
                  />
                  {/* Legend */}
                  <div className="absolute top-2 left-2 bg-white/90 rounded p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>Aktif</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>Direvisi</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Dicabut</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Node Detail */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Detail Pasal</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNode ? (
                <div className="space-y-4">
                  <div>
                    <Badge
                      variant={
                        selectedNode.status === "aktif"
                          ? "success"
                          : selectedNode.status === "direvisi"
                          ? "warning"
                          : "destructive"
                      }
                    >
                      {selectedNode.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedNode.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedNode.regulation}
                    </p>
                  </div>
                  {selectedNode.teks && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Teks:</h4>
                      <p className="text-sm text-muted-foreground bg-slate-50 p-3 rounded max-h-64 overflow-y-auto">
                        {selectedNode.teks}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Klik node pada graph untuk melihat detail</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
