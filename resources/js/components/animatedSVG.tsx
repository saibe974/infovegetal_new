import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface AnimatedSVGProps {
    svg: string;
    duration?: number;
}

export default function AnimatedSVG({ svg, duration = 3 }: AnimatedSVGProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // insère le SVG brut
        containerRef.current.innerHTML = svg;
        const svgElement = containerRef.current.querySelector("svg") as SVGSVGElement;
        if (!svgElement) return;

        const paths = Array.from(svgElement.querySelectorAll<SVGPathElement>("path"));

        if (paths.length === 0) return;

        // Prépare chaque path : si path a un fill (et pas de stroke), on l'utilise comme stroke temporaire
        const infos = paths.map((path) => {
            const origFill = path.getAttribute("fill") || null;
            const origStroke = path.getAttribute("stroke") || null;
            const origStrokeWidth = path.getAttribute("stroke-width") || null;

            // calc length (doit être appelé après insertion dans le DOM)
            let len = 0;
            try {
                len = path.getTotalLength();
            } catch (e) {
                len = 0;
            }

            // si path est rempli mais sans stroke, on transforme pour animer
            if (origFill && origFill !== "none" && !origStroke) {
                path.setAttribute("stroke", origFill);
                path.setAttribute("stroke-width", "1"); // ajuster si besoin
                path.setAttribute("fill", "none");
                path.style.strokeLinecap = "round";
                path.style.strokeLinejoin = "round";
            }

            // configure dash
            path.style.strokeDasharray = `${len} ${len}`;
            path.style.strokeDashoffset = `${len}`;

            return { path, len, origFill, origStroke, origStrokeWidth };
        });

        // Timeline : dessiner les paths proportionnellement à leur longueur
        const totalLength = infos.reduce((s, i) => s + (i.len || 0), 0) || 1;
        const tl = gsap.timeline();

        infos.forEach((info) => {
            const part = (info.len || 0) / totalLength;
            const partDuration = Math.max(0.08, duration * part); // min duration pour petits paths
            tl.to(
                info.path,
                { strokeDashoffset: 0, duration: partDuration, ease: "power1.inOut" },
                "<"
            );
        });

        // Après l'animation, restaurer le fill si on l'avait supprimé (optionnel)
        // tl.call(() => {
        //     infos.forEach((info) => {
        //         // si on avait remplacé fill par stroke (origFill présent et origStroke absent), restaure le fill
        //         if (info.origFill && !info.origStroke) {
        //             info.path.setAttribute("fill", info.origFill);
        //             info.path.removeAttribute("stroke");
        //             if (info.origStrokeWidth) {
        //                 info.path.setAttribute("stroke-width", info.origStrokeWidth);
        //             } else {
        //                 info.path.removeAttribute("stroke-width");
        //             }
        //             // nettoyer les dash styles
        //             info.path.style.strokeDasharray = "";
        //             info.path.style.strokeDashoffset = "";
        //         } else {
        //             // garde le stroke visible pour paths qui avaient déjà un stroke
        //             info.path.style.strokeDasharray = "";
        //             info.path.style.strokeDashoffset = "";
        //         }
        //     });
        // });

        return () => {
            tl.kill();
        };
    }, [svg, duration]);

    return <div className="w-full h-full flex items-center justify-center" ref={containerRef}></div>;
}