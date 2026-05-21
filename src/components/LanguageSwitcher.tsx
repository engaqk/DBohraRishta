"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Globe, ChevronDown, Check } from 'lucide-react';

interface LanguageSwitcherProps {
    variant?: 'nav' | 'floating' | 'login';
}

export default function LanguageSwitcher({ variant = 'nav' }: LanguageSwitcherProps) {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const languages = [
        { code: 'en', name: 'English', localName: 'English', flag: '🇬🇧' },
        { code: 'gu', name: 'Gujarati', localName: 'ગુજરાતી', flag: '🇮🇳' },
        { code: 'hi', name: 'Hindi', localName: 'हिन्दी', flag: '🇮🇳' }
    ] as const;

    const currentLang = languages.find(l => l.code === language) || languages[0];

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleSelect = (code: 'en' | 'gu' | 'hi') => {
        setLanguage(code);
        setIsOpen(false);
    };

    // Styling variants
    const buttonClasses = {
        nav: "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-300 border border-gray-100 hover:border-[#881337]/20 hover:bg-rose-50/50 text-gray-700 hover:text-[#881337]",
        floating: "fixed bottom-5 right-5 z-[99] bg-white/90 backdrop-blur-md text-[#881337] border border-rose-100 p-3 rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300",
        login: "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border border-rose-100 hover:border-[#881337]/30 hover:bg-rose-50 text-[#881337] bg-white shadow-sm"
    }[variant];

    const dropdownClasses = {
        nav: "absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-[150] animate-in fade-in slide-in-from-top-2 duration-200",
        floating: "absolute bottom-14 right-0 mb-2 w-44 bg-white rounded-2xl shadow-xl border border-rose-100 py-1.5 z-[150] animate-in fade-in slide-in-from-bottom-2 duration-200",
        login: "absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-rose-100 py-1.5 z-[150] animate-in fade-in slide-in-from-top-2 duration-200"
    }[variant];

    return (
        <div className="relative inline-block text-left" ref={containerRef}>
            <button
                onClick={toggleDropdown}
                className={buttonClasses}
                type="button"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <Globe className="w-4 h-4 text-[#D4AF37]" />
                <span className="font-medium shrink-0">{currentLang.localName}</span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className={dropdownClasses}>
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                        Select Language
                    </div>
                    {languages.map((lang) => {
                        const isSelected = lang.code === language;
                        return (
                            <button
                                key={lang.code}
                                onClick={() => handleSelect(lang.code)}
                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors duration-150
                                    ${isSelected 
                                        ? 'bg-rose-50/70 text-[#881337] font-bold' 
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-base select-none">{lang.flag}</span>
                                    <div className="flex flex-col">
                                        <span className="leading-none">{lang.localName}</span>
                                        {lang.name !== lang.localName && (
                                            <span className="text-[10px] text-gray-400 mt-0.5">{lang.name}</span>
                                        )}
                                    </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-[#881337] stroke-[3]" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
