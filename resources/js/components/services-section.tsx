import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import DrawSVGPlugin from "gsap/DrawSVGPlugin";
import AnimatedSVG from "./animatedSVG";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { services } from '../data/services'
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
    gsap.registerPlugin(DrawSVGPlugin);
    gsap.registerPlugin(ScrollTrigger);
}

export default function servicesSection({ active }: { active: boolean }) {
    const [activeId, setActiveId] = useState(1);
    const activeItem = services.find((d: any) => d.id === activeId)!;
    const sectionRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        const allTexts = sectionRef.current?.querySelectorAll<HTMLElement>(".about-text") || [];
        const activeText = sectionRef.current?.querySelector<HTMLElement>(
            `.about-btn[data-id="${activeId}"] .about-text`
        );
        const aboutTitles = sectionRef.current?.querySelectorAll<HTMLElement>(".about-title-parent") || [];
        const activeTitle = sectionRef.current?.querySelector<HTMLElement>(
            `.about-btn[data-id="${activeId}"] .about-title-parent`
        );

        allTexts.forEach((text) => {
            if (text !== activeText) {
                gsap.to(text, {
                    opacity: 0,
                    height: 0,
                    duration: 0.4,
                    ease: "power2.inOut"
                });
            }
        });

        aboutTitles.forEach((title) => {
            if (title !== activeTitle) {
                gsap.to(title, {
                    yPercent: 200,
                    duration: 0.4,
                    ease: "power2.inOut"
                });
            }
        });

        if (activeTitle) {
            gsap.to(activeTitle, {
                yPercent: 0,
                duration: 0.4,
                ease: "power2.inOut"
            });
        }


        if (activeText) {
            const split = new SplitText(activeText, { type: "lines" });
            const lines = split.lines as HTMLElement[];

            const finalHeight = activeText.scrollHeight;

            gsap.fromTo(
                activeText,
                { height: 0 },
                {
                    height: finalHeight,
                    duration: 0.4,
                    ease: "power2.inOut",
                }
            );

            gsap.fromTo(
                lines,
                { y: 20, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.4,
                    stagger: 0.08,
                    ease: "power2.out"
                }
            );
        }
    }, [activeId]);




    return (
        <section ref={sectionRef} className="flex flex-col items-center justify-center w-full h-full gap-5 lg:gap-10 px-10 lg:px-10">
            <h3 className='uppercase text-3xl md:text-5xl font-sans'>nos services</h3>
            <div className="flex flex-col-reverse lg:flex-row items-center w-full justify-around gap-5 lg:gap-0">
                <div className="flex flex-col md:flex-row lg:flex-col lg:gap-10 xl:gap-0  items-center xl:w-1/4">
                    {services.map((item) => (
                        <button
                            key={item.id}
                            data-id={item.id}
                            onClick={() => setActiveId(item.id)}
                            className={`w-fit lg:w-full cursor-pointer about-btn flex flex-col items-start p-4 transition-all duration-300 h-[18rem] justify-around ${activeId === item.id
                                ? " bg-black/10 dark:bg-accent"
                                : " hover:bg-black/10 dark:hover:bg-accent"
                                }`}
                        >
                            <h3 className="about-title-parent font-inter font-normal text-lg sm:text-xl w-full gap-3 flex ">
                                <span className={`about-title w-fit ${activeId === item.id ? "" : "text-main-purple dark:text-main-green"}`}>0{item.id}</span>
                                <span className="about-title transition-all duration-200">{item.title}</span>
                            </h3>
                            <p
                                className="about-text text-left text-md lg:text-lg mt-2 overflow-hidden"
                                style={{ opacity: activeId === item.id ? 1 : 0 }}
                                 dangerouslySetInnerHTML={{ __html: item.text }}
                            />
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-center w-11/12 xl:w-1/3 text-main-purple dark:text-main-green">
                    {<AnimatedSVG svg={activeItem.svg} />}
                </div>
            </div>
        </section>
    );
}