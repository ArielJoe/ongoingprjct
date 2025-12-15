
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    // Helper for link classes
    const linkClass = (path: string) => `
    font-medium transition-colors
    ${isActive(path) ? "text-brand-mint" : "text-gray-600 hover:text-brand-mint"}
  `;

    const mobileLinkClass = (path: string) => `
    block px-3 py-2 text-base font-medium rounded-md
    ${isActive(path) ? "text-brand-mint bg-emerald-50" : "text-gray-700 hover:text-brand-mint hover:bg-gray-50"}
  `;

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass-panel shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <span className="font-bold text-xl tracking-tight text-brand-dark">Ongoing Project</span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-8">
                        <Link href="/" className={linkClass("/")}>Home</Link>
                        <Link href="/customizer" className={linkClass("/customizer")}>Customize Keychain</Link>
                        {pathname !== "/customizer" && (
                            <>
                                <Link href="#products" className="text-gray-600 hover:text-brand-mint font-medium transition-colors">Products</Link>
                                <Link href="#contact" className="text-gray-600 hover:text-brand-mint font-medium transition-colors">Contact</Link>
                            </>
                        )}
                        {pathname !== "/customizer" && (
                            <Link
                                href="/customizer"
                                className="px-6 py-2.5 bg-brand-mint text-white font-semibold rounded-full hover:bg-emerald-500 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                Mulai Custom
                            </Link>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="text-gray-600 hover:text-brand-mint p-2"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-gray-100 absolute w-full">
                    <div className="px-4 pt-2 pb-6 space-y-2">
                        <Link
                            href="/"
                            className={mobileLinkClass("/")}
                            onClick={() => setIsOpen(false)}
                        >
                            Home
                        </Link>
                        <Link
                            href="/customizer"
                            className={mobileLinkClass("/customizer")}
                            onClick={() => setIsOpen(false)}
                        >
                            Customize Keychain
                        </Link>
                        {pathname !== "/customizer" && (
                            <>
                                <Link
                                    href="#products"
                                    className={mobileLinkClass("#products")} // Logic slightly imperfect for hash links but OK
                                    onClick={() => setIsOpen(false)}
                                >
                                    Products
                                </Link>
                                <Link
                                    href="#contact"
                                    className={mobileLinkClass("#contact")}
                                    onClick={() => setIsOpen(false)}
                                >
                                    Contact
                                </Link>
                            </>
                        )}
                        {pathname !== "/customizer" && (
                            <div className="pt-4">
                                <Link
                                    href="/customizer"
                                    className="block w-full text-center px-6 py-3 bg-brand-mint text-white font-semibold rounded-lg hover:bg-emerald-500 transition-colors shadow-sm"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Mulai Custom
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}
