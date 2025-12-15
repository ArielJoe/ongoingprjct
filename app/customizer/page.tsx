
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { ASSETS } from "../lib/constants";
import { Download, RefreshCw, MessageCircle, ZoomIn, ZoomOut, Check, ChevronLeft, ChevronRight, Edit, Eye } from "lucide-react";

// Types
type CharmSlot = 'A' | 'B' | 'C';
type SelectionState = {
    baseIndex: number;
    slots: {
        A: number | null; // Bottom
        B: number | null; // Middle
        C: number | null; // Top
    };
    zoom: number;
};

export default function CustomizerPage() {
    // Types
    type Mode = 'fixed' | 'manual';
    type CharmItem = {
        id: string;
        charmIndex: number;
        x: number;
        y: number;
        z: number; // Scale
    };

    // State
    const [state, setState] = useState<{
        mode: Mode;
        baseIndex: number;
        slots: { A: number | null; B: number | null; C: number | null };
        manualItems: CharmItem[];
        zoom: number;
    }>({
        mode: 'fixed',
        baseIndex: 0,
        slots: { A: null, B: null, C: null },
        manualItems: [],
        zoom: 0.65,
    });

    // Manual Mode Specific State
    const [isEditing, setIsEditing] = useState(true); // Toggle between Edit (Guides/Drag) and Preview (Clean)

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [draggedItem, setDraggedItem] = useState<string | null>(null); // ID of item being moved on canvas
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // Custom Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
    });

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmModal({ isOpen: true, title, message, onConfirm });
    };

    const closeConfirm = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    // Constants
    const CANVAS_SIZE = 800;

    // Fixed Positions
    const CHARM_POSITIONS = {
        C: { x: 0.5, y: 0.31, scale: 0.28 },
        B: { x: 0.5, y: 0.58, scale: 0.28 },
        A: { x: 0.5, y: 0.85, scale: 0.28 },
    };

    // Helper: Load Image with Cache (Robust with decode)
    const loadImage = async (src: string): Promise<HTMLImageElement | null> => {
        if (imageCache.current.has(src)) return imageCache.current.get(src)!;

        const img = new window.Image();
        img.src = src;
        try {
            await img.decode();
            imageCache.current.set(src, img);
            return img;
        } catch (err) {
            console.error(`Failed to decode image: ${src}`, err);
            // Fallback to standard load
            return new Promise((resolve) => {
                img.onload = () => {
                    imageCache.current.set(src, img);
                    resolve(img);
                };
                img.onerror = () => resolve(null);
            });
        }
    };

    // Helper: Screen to Canvas Coords
    const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            const touch = e.touches[0] || e.changedTouches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const cx = rect.width / 2;
        const cy = rect.height / 2;

        const relX = (clientX - rect.left - cx) / state.zoom + (CANVAS_SIZE / 2);
        const relY = (clientY - rect.top - cy) / state.zoom + (CANVAS_SIZE / 2);

        return {
            x: relX / CANVAS_SIZE,
            y: relY / CANVAS_SIZE
        };
    };

    // Generator Preview
    const updatePreview = () => {
        if (canvasRef.current) {
            // We need to render cleanly without guides for the preview
            // But getting dataURL captures what's currently on canvas.
            // If guides are on, they will be captured. 
            // For now, let's just capture what is seen. User should switch to "Preview" mode to generate clean image.
            setPreviewUrl(canvasRef.current.toDataURL("image/png"));
        }
    };

    // -------------------
    // RENDER LOGIC
    // -------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let isMounted = true;

        const render = async () => {
            // 1. Pre-load all assets first
            // Don't clear rect yet!

            try {
                // Base
                const basePath = ASSETS.keychains[state.baseIndex];

                // Charms to draw
                const charmRequests: { path: string, x: number, y: number, scale: number, isSelected: boolean, id?: string }[] = [];

                if (state.mode === 'fixed') {
                    if (state.slots.A !== null) charmRequests.push({ path: ASSETS.animals[state.slots.A], ...CHARM_POSITIONS.A, isSelected: false });
                    if (state.slots.B !== null) charmRequests.push({ path: ASSETS.animals[state.slots.B], ...CHARM_POSITIONS.B, isSelected: false });
                    if (state.slots.C !== null) charmRequests.push({ path: ASSETS.animals[state.slots.C], ...CHARM_POSITIONS.C, isSelected: false });
                } else {
                    state.manualItems.forEach(item => {
                        charmRequests.push({
                            path: ASSETS.animals[item.charmIndex],
                            x: item.x,
                            y: item.y,
                            scale: item.z,
                            isSelected: item.id === draggedItem,
                            id: item.id
                        });
                    });
                }

                // Wait for all images
                const [baseImg, ...charmImages] = await Promise.all([
                    loadImage(basePath),
                    ...charmRequests.map(req => loadImage(req.path))
                ]);

                if (!isMounted) return;

                // 2. NOW we draw everything synchronously
                ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                ctx.save();
                ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
                ctx.scale(state.zoom, state.zoom);
                ctx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);

                // Draw Base
                if (baseImg) {
                    const baseScale = 0.8;
                    const bw = CANVAS_SIZE * baseScale;
                    const bh = (bw / baseImg.width) * baseImg.height;
                    const bx = (CANVAS_SIZE - bw) / 2;
                    const by = (CANVAS_SIZE - bh) / 2;

                    ctx.shadowColor = "rgba(0,0,0,0.2)";
                    ctx.shadowBlur = 20;
                    ctx.shadowOffsetY = 10;
                    ctx.drawImage(baseImg, bx, by, bw, bh);
                    // Base guide removed as per request
                } else {
                    // DEBUG: Visual error on canvas
                    ctx.fillStyle = "#EF4444";
                    ctx.font = "bold 24px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("Error: Gagal memuat gambar base.", CANVAS_SIZE / 2, CANVAS_SIZE / 2);
                    ctx.font = "16px sans-serif";
                    ctx.fillText(basePath || "Unknown path", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 30);
                }

                ctx.shadowColor = "transparent";

                // Draw Charms
                charmRequests.forEach((req, idx) => {
                    const img = charmImages[idx];
                    if (!img) return;

                    const cw = CANVAS_SIZE * req.scale;
                    const ch = (cw / img.width) * img.height;
                    const cx = (CANVAS_SIZE * req.x) - (cw / 2);
                    const cy = (CANVAS_SIZE * req.y) - (ch / 2);

                    ctx.shadowColor = "rgba(0,0,0,0.1)";
                    ctx.shadowBlur = 5;
                    ctx.drawImage(img, cx, cy, cw, ch);
                    ctx.shadowColor = "transparent";

                    if (state.mode === 'manual' && isEditing && req.isSelected) {
                        ctx.strokeStyle = '#10B981';
                        ctx.lineWidth = 2 / state.zoom;
                        ctx.setLineDash([5, 5]);
                        ctx.strokeRect(cx - 2, cy - 2, cw + 4, ch + 4);
                        ctx.setLineDash([]);

                        // Center Dot Handle
                        ctx.fillStyle = '#10B981';
                        ctx.beginPath();
                        ctx.arc(cx + cw / 2, cy + ch / 2, 6 / state.zoom, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });

            } catch (err) {
                console.error("Render error", err);
            } finally {
                ctx.restore();
            }
        };

        render();

        // Initial preview generation only if not dragging
        if (!draggedItem) {
            const timeout = setTimeout(updatePreview, 500);
            return () => clearTimeout(timeout);
        }

        return () => { isMounted = false; };
    }, [state, isEditing, draggedItem]);

    // -------------------
    // MODE SWITCHING
    // -------------------
    const switchMode = (newMode: Mode) => {
        if (newMode === state.mode) return;

        if (newMode === 'manual' && state.mode === 'fixed') {
            // Convert slots to manual items
            const newItems: CharmItem[] = [];
            if (state.slots.A !== null) newItems.push({ id: crypto.randomUUID(), charmIndex: state.slots.A, x: CHARM_POSITIONS.A.x, y: CHARM_POSITIONS.A.y, z: CHARM_POSITIONS.A.scale });
            if (state.slots.B !== null) newItems.push({ id: crypto.randomUUID(), charmIndex: state.slots.B, x: CHARM_POSITIONS.B.x, y: CHARM_POSITIONS.B.y, z: CHARM_POSITIONS.B.scale });
            if (state.slots.C !== null) newItems.push({ id: crypto.randomUUID(), charmIndex: state.slots.C, x: CHARM_POSITIONS.C.x, y: CHARM_POSITIONS.C.y, z: CHARM_POSITIONS.C.scale });

            setState(s => ({ ...s, mode: 'manual', manualItems: newItems }));
            setIsEditing(true); // Default to edit mode
        } else if (newMode === 'fixed') {
            showConfirm(
                "Kembali ke Template Mode?",
                "Posisi manual Anda akan hilang jika kembali ke mode ini. Lanjutkan?",
                () => setState(s => ({ ...s, mode: 'fixed' }))
            );
        }
    };

    // -------------------
    // CANVAS INTERACTION (MANUAL MODE)
    // -------------------
    const handleCanvasMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (state.mode !== 'manual' || !isEditing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Prevent scrolling on touch
        if ('touches' in e) {
            // e.preventDefault(); // Don't prevent default here instantly or click might fail? 
            // Better to handle in the container specific touch-action
        }

        const coords = getCanvasCoords(e, canvas);

        const clickedItem = [...state.manualItems].reverse().find(item => {
            const dx = coords.x - item.x;
            const dy = coords.y - item.y;
            // Hit radius increased to matches charm scale (~0.28/2 = 0.14)
            return (dx * dx + dy * dy) < (0.14 * 0.14);
        });

        if (clickedItem) {
            setDraggedItem(clickedItem.id);
            setDragOffset({ x: coords.x - clickedItem.x, y: coords.y - clickedItem.y });
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!draggedItem || state.mode !== 'manual' || !isEditing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const coords = getCanvasCoords(e, canvas);

        setState(s => ({
            ...s,
            manualItems: s.manualItems.map(item =>
                item.id === draggedItem
                    ? { ...item, x: coords.x - dragOffset.x, y: coords.y - dragOffset.y }
                    : item
            )
        }));
    };

    const handleCanvasMouseUp = () => {
        if (draggedItem) {
            setDraggedItem(null);
            updatePreview(); // Update preview when drag ends
        }
    };

    // Drag from Sidebar
    const handleDragStart = (e: React.DragEvent, charmIndex: number) => {
        e.dataTransfer.setData("charmIndex", charmIndex.toString());
    };

    const handleDrop = (e: React.DragEvent) => {
        if (state.mode !== 'manual' || !isEditing) return;
        e.preventDefault();
        const charmIndex = parseInt(e.dataTransfer.getData("charmIndex"));
        if (isNaN(charmIndex)) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const coords = getCanvasCoords(e, canvas);

        const newItem: CharmItem = {
            id: crypto.randomUUID(),
            charmIndex,
            x: coords.x,
            y: coords.y,
            z: 0.28
        };

        setState(s => ({ ...s, manualItems: [...s.manualItems, newItem] }));
        setTimeout(updatePreview, 100);
    };

    // -------------------
    // UTILS
    // -------------------
    const handleWhatsApp = () => {
        const text = `Halo Ongoing Project! Saya mau order custom keychain.\n\n` +
            `*Gambar desain saya lampirkan manual setelah pesan ini.*\n\n` +
            `Mohon info total harganya ya! Terima kasih.`;
        window.open(`https://wa.me/6288218541267?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleDownload = () => {
        // If in edit mode, warn user or temporarily render clean?
        // Ideally we grab the previewUrl which SHOULD be clean if they switched to preview mode
        // But let's generate a clean grab right now just in case
        if (!canvasRef.current) return;
        const link = document.createElement("a");
        link.download = `ongoing-keychain-${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL("image/png");
        link.click();
    };

    const handleReset = () => {
        showConfirm(
            "Reset Desain?",
            "Semua perubahan akan dihapus dan kembali ke awal.",
            () => {
                setState({
                    mode: 'fixed',
                    baseIndex: 0,
                    slots: { A: null, B: null, C: null },
                    manualItems: [],
                    zoom: 0.65
                });
                setIsEditing(true);
            }
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Navbar />
            <main className="flex-grow pt-24 pb-10 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto w-full h-full">
                <h1 className="sr-only">Studio Kustomisasi Keychain</h1>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-start">

                    {/* LEFT: BASE */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-10 h-10 rounded-full bg-brand-yellow/20 flex items-center justify-center text-brand-yellow-dark text-lg">1</span>
                                Pilih Base
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {ASSETS.keychains.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setState(s => ({ ...s, baseIndex: idx }))}
                                        className={`relative aspect-square rounded-xl border-2 transition-all overflow-hidden bg-gray-50 ${state.baseIndex === idx ? 'border-brand-mint ring-4 ring-brand-mint/10' : 'border-transparent hover:border-brand-mint/50'}`}
                                    >
                                        <Image src={img} alt={`Base ${idx}`} fill className="object-contain p-2" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* MIDDLE: CANVAS */}
                    <div className="lg:col-span-5 flex flex-col lg:sticky lg:top-28">
                        {/* Mode Toggles */}
                        <div className="flex gap-2 mb-4">
                            {/* Fixed vs Manual */}
                            <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex flex-1">
                                <button
                                    onClick={() => switchMode('fixed')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${state.mode === 'fixed' ? 'bg-brand-mint text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    Template
                                </button>
                                <button
                                    onClick={() => switchMode('manual')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${state.mode === 'manual' ? 'bg-brand-mint text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    Free Drag
                                </button>
                            </div>
                        </div>

                        {/* Editor Toolbar (Manual Only) */}
                        {state.mode === 'manual' && (
                            <div className="flex justify-between items-center mb-4 px-2">
                                <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors ${isEditing ? 'bg-brand-yellow text-brand-dark' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        <Edit size={14} /> Editor
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors ${!isEditing ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        <Eye size={14} /> Preview
                                    </button>
                                </div>
                                {isEditing && <span className="text-xs text-brand-mint font-medium animate-pulse">● Editing Active</span>}
                            </div>
                        )}

                        <div
                            className="flex-grow bg-white rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden flex items-center justify-center min-h-[400px] aspect-square group"
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={handleDrop}
                            onWheel={(e) => e.preventDefault()}
                            style={{ touchAction: 'none' }}
                        >
                            <div className={`absolute inset-0 transition-opacity duration-300 ${isEditing ? 'opacity-5' : 'opacity-0'}`} style={{ backgroundImage: 'radial-gradient(#10B981 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                            <canvas
                                onMouseDown={handleCanvasMouseDown}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseUp}
                                onTouchStart={handleCanvasMouseDown}
                                onTouchMove={handleCanvasMouseMove}
                                onTouchEnd={handleCanvasMouseUp}
                            />

                            {/* Zoom Buttons */}
                            <div className="absolute bottom-6 right-6 flex gap-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="pointer-events-auto flex gap-2">
                                    <button onClick={() => setState(s => ({ ...s, zoom: Math.min(s.zoom + 0.1, 2) }))} className="bg-white p-2.5 rounded-full shadow-lg border border-gray-100 text-gray-700">
                                        <ZoomIn size={20} />
                                    </button>
                                    <button onClick={() => setState(s => ({ ...s, zoom: Math.max(s.zoom - 0.1, 0.4) }))} className="bg-white p-2.5 rounded-full shadow-lg border border-gray-100 text-gray-700">
                                        <ZoomOut size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 text-center text-gray-400 text-sm">
                            {state.mode === 'manual'
                                ? (isEditing ? "Drag charm untuk mengatur posisi. Gunakan 'Preview' untuk melihat hasil akhir." : "Mode Preview aktif. Kembali ke Editor untuk mengubah.")
                                : "Pilih slot di kanan untuk menambahkan charm secara otomatis."}
                        </div>
                    </div>

                    {/* RIGHT: CHARMS */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-10 h-10 rounded-full bg-brand-pink/20 flex items-center justify-center text-brand-pink-dark text-lg">2</span>
                                Pilih Charms
                            </h2>

                            {state.mode === 'fixed' ? (
                                <>
                                    <SlotControl
                                        label="Atas"
                                        isSelected={state.slots.C !== null}
                                        onClear={() => setState(s => ({ ...s, slots: { ...s.slots, C: null } }))}
                                    >
                                        <CharmList selectedIdx={state.slots.C} onSelect={(idx) => setState(s => ({ ...s, slots: { ...s.slots, C: idx } }))} />
                                    </SlotControl>
                                    <SlotControl
                                        label="Tengah"
                                        isSelected={state.slots.B !== null}
                                        onClear={() => setState(s => ({ ...s, slots: { ...s.slots, B: null } }))}
                                    >
                                        <CharmList selectedIdx={state.slots.B} onSelect={(idx) => setState(s => ({ ...s, slots: { ...s.slots, B: idx } }))} />
                                    </SlotControl>
                                    <SlotControl
                                        label="Bawah"
                                        isSelected={state.slots.A !== null}
                                        onClear={() => setState(s => ({ ...s, slots: { ...s.slots, A: null } }))}
                                    >
                                        <CharmList selectedIdx={state.slots.A} onSelect={(idx) => setState(s => ({ ...s, slots: { ...s.slots, A: idx } }))} />
                                    </SlotControl>
                                </>
                            ) : (
                                <div>
                                    <div className={`transition-opacity ${!isEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <p className="text-sm text-gray-500 mb-4 px-1">Drag gambar ke canvas (Editor Mode Only).</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {ASSETS.animals.map((img, idx) => (
                                                <div
                                                    key={idx}
                                                    draggable={isEditing}
                                                    onDragStart={(e) => handleDragStart(e, idx)}
                                                    className="aspect-square bg-gray-50 rounded-lg border border-gray-200 cursor-move hover:border-brand-mint overflow-hidden relative"
                                                    onClick={() => {
                                                        if (isEditing) {
                                                            const newItem: CharmItem = { id: crypto.randomUUID(), charmIndex: idx, x: 0.5, y: 0.5, z: 0.28 };
                                                            setState(s => ({ ...s, manualItems: [...s.manualItems, newItem] }));
                                                            setTimeout(updatePreview, 100);
                                                        }
                                                    }}
                                                >
                                                    <Image src={img} alt="Charm" fill className="object-contain p-1" />
                                                </div>
                                            ))}
                                        </div>
                                        {state.manualItems.length > 0 && (
                                            <button
                                                onClick={() => setState(s => ({ ...s, manualItems: [] }))}
                                                className="mt-4 w-full py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg"
                                            >
                                                Hapus Semua Charm
                                            </button>
                                        )}
                                    </div>
                                    {!isEditing && <p className="text-xs text-center text-red-500 mt-2">Beralih ke Editor Mode untuk menambah charm.</p>}
                                </div>
                            )}
                        </div>

                        {/* SUMMARY */}
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-brand-mint/20 relative overflow-hidden">
                            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-10 h-10 rounded-full bg-brand-mint/20 flex items-center justify-center text-brand-mint-dark text-lg">3</span>
                                Ringkasan Pesanan
                            </h3>
                            <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Preview Hasil</div>
                                <div className="relative w-full aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    {previewUrl ? (
                                        <Image src={previewUrl} alt="Preview" fill className="object-contain" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-300">Loading...</div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <button onClick={handleWhatsApp} className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all hover:-translate-y-0.5">
                                    <MessageCircle size={20} /> Order via WhatsApp
                                </button>
                                <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors text-sm">
                                    <Download size={16} /> Save Image
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-semibold py-3 rounded-xl transition-colors text-sm"
                                >
                                    <RefreshCw size={16} />
                                    Reset
                                </button>
                                <p className="text-xs text-center text-gray-400 mt-2">*Simpan gambar desain sebelum order.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Custom Confirmation Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
                        <p className="text-gray-600 mb-6">{confirmModal.message}</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={closeConfirm}
                                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => {
                                    confirmModal.onConfirm();
                                    closeConfirm();
                                }}
                                className="px-4 py-2 bg-brand-mint text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30"
                            >
                                Ya, Lanjutkan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Subcomponents
function SlotControl({ label, isSelected, onClear, children }: { label: string, isSelected: boolean, onClear: () => void, children: React.ReactNode }) {
    return (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-700">{label}</span>
                {isSelected && <button onClick={onClear} className="text-xs text-red-500 hover:text-red-600">Hapus</button>}
            </div>
            {children}
        </div>
    );
}

function CharmList({ selectedIdx, onSelect }: { selectedIdx: number | null, onSelect: (i: number) => void }) {
    return (
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {ASSETS.animals.map((img, idx) => (
                <button
                    key={idx}
                    onClick={() => onSelect(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden bg-white relative transition-all snap-start ${selectedIdx === idx ? 'border-brand-mint ring-2 ring-brand-mint/20' : 'border-gray-200 hover:border-brand-mint/50'}`}
                >
                    <Image src={img} alt={`Charm ${idx}`} fill className="object-contain p-1" />
                    {selectedIdx === idx && <div className="absolute inset-0 bg-brand-mint/10 flex items-center justify-center"><Check size={12} className="text-brand-mint bg-white rounded-full p-0.5" /></div>}
                </button>
            ))}
        </div>
    );
}

