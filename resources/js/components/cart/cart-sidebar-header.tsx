import { CheckCircle, Eye, PlusCircle, Save, Trash2 } from "lucide-react";
import { SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

export function CartSidebarHeader() {
    return (
        <SidebarMenu className="flex flex-row w-full justify-between gap-2 md:mt-14">
            {/* Vider le panier */}
            <SidebarMenuItem className='w-fit'>
                <SidebarMenuButton asChild title='Vider le panier'>
                    <button
                        type="button"
                        aria-label="Vider le panier"
                        className="p-2 rounded hover:bg-muted "
                        onClick={() => {
                            // action: vider le panier
                        }}
                    >
                        <Trash2 className="size-5 text-destructive" aria-label='Vider le panier' />
                    </button>
                </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Insérer dans le panier */}
            <SidebarMenuItem className='w-fit' >
                <SidebarMenuButton asChild title='Insérer dans le panier'>
                    <button
                        type="button"
                        aria-label="Insérer dans le panier"
                        className="p-2 rounded hover:bg-muted"
                        onClick={() => {
                            // action: insérer dans le panier
                        }}
                    >
                        <PlusCircle className="size-5" />
                    </button>
                </SidebarMenuButton>
            </SidebarMenuItem >

            {/* Voir le panier */}
            <SidebarMenuItem className='w-fit'>
                <SidebarMenuButton asChild title='Voir le panier'>
                    <button
                        type="button"
                        aria-label="Voir le panier"
                        className="p-2 rounded hover:bg-muted"
                        onClick={() => {
                            // action: ouvrir/afficher le panier
                        }}
                    >
                        <Eye className="size-5" />
                    </button>
                </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Sauvegarder le panier */}
            <SidebarMenuItem className='w-fit'>
                <SidebarMenuButton asChild title='Sauvegarder le panier'>
                    <button
                        type="button"
                        aria-label="Sauvegarder le panier"
                        className="p-2 rounded hover:bg-muted"
                        onClick={() => {
                            // action: sauvegarder panier
                        }}
                    >
                        <Save className="size-5" />
                    </button>
                </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Valider le panier */}
            <SidebarMenuItem className='w-fit'>
                <SidebarMenuButton asChild title='Valider le panier'>
                    <button
                        type="button"
                        aria-label="Valider le panier"
                        className="p-2 rounded hover:bg-muted"
                        onClick={() => {
                            // action: valider panier
                        }}
                    >
                        <CheckCircle className=" text-green-600" />
                    </button>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}