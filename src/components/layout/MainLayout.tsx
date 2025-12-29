import { ParentComponent } from "solid-js";
import { TitleBar } from "../TitleBar";

interface MainLayoutProps {
    showTitleBar?: boolean;
}

export const MainLayout: ParentComponent<MainLayoutProps> = (props) => {
    return (
        <div class="flex flex-col h-screen bg-[#0F172A] text-slate-200 font-['Figtree'] overflow-hidden">
            {props.showTitleBar !== false && <TitleBar />}
            <div class="flex-1 overflow-hidden">{props.children}</div>
        </div>
    );
};
