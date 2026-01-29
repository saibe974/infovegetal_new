import { Head, Link, router, usePage, Form } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { Button } from '@/components/ui/button';
import { BreadcrumbItem, type SharedData, type User } from '@/types';
import { useI18n } from '@/lib/i18n';
import { FormField } from '@/components/ui/form-field';
import SearchSelect from '@/components/app/search-select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type DbProductAttributes = {
    m: number;          // marge en %
    mm: number;         // marge min par roll
    pd: number;         // coef de pondération
    h: number;          // hausse sur roll
    l: number;          // livraison
    c: string;          // catégorie de marges
    mc: number;         // marge par carton
    me: number;         // marge par étage
    mr: number;         // marge par roll
    tvap: number;       // tva produit
    tvat: number | null;// tva transport
    p: string;          // -1=auto, 0=prix départ, 1=prix rendu, ou nom de champ prix spécial
};

const DEFAULT_ATTRIBUTES: DbProductAttributes = {
    m: 0,
    mm: 0,
    pd: 0,
    h: 1,
    l: 0,
    c: 'admin',
    mc: 0,
    me: 0,
    mr: 0,
    tvap: 0,
    tvat: null,
    p: '-1',
};

export default function UserDbPage() {
    const { auth, user: propsUser, dbProducts, selectedDbId, dbUserAttributes } = usePage<SharedData & {
        user: User;
        dbProducts: Array<{ id: number; name: string; description?: string }>;
        selectedDbId?: number[];
        dbUserAttributes?: Record<number, any>
    }>().props as any;

    const { t } = useI18n();
    const targetUser: User = propsUser;

    // État pour les attributs de chaque DB
    const [attributesByDbId, setAttributesByDbId] = useState<Record<number, DbProductAttributes>>(() => {
        const initial: Record<number, DbProductAttributes> = {};
        if (dbUserAttributes && typeof dbUserAttributes === 'object') {
            Object.entries(dbUserAttributes).forEach(([dbId, attrs]) => {
                if (attrs && typeof attrs === 'object') {
                    initial[Number(dbId)] = { ...DEFAULT_ATTRIBUTES, ...attrs as Partial<DbProductAttributes> };
                } else {
                    initial[Number(dbId)] = { ...DEFAULT_ATTRIBUTES };
                }
            });
        }
        return initial;
    });

    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>(Array.isArray(selectedDbId) ? selectedDbId : []);
    const [processing, setProcessing] = useState(false);

    // Préparer la sélection initiale pour SearchSelect
    const initialSelection = useMemo(() => {
        return (Array.isArray(selectedDbId) ? selectedDbId : []).map((id: number) => {
            const found = (dbProducts as any[]).find((d) => d.id === id);
            return { value: found ? found.name : String(id), label: found ? found.name : String(id) };
        });
    }, [dbProducts, selectedDbId]);

    // Initialiser les attributs pour les nouvelles sélections
    useEffect(() => {
        setAttributesByDbId(prev => {
            const updated = { ...prev };
            selectedIds.forEach(id => {
                if (!updated[id]) {
                    updated[id] = { ...DEFAULT_ATTRIBUTES };
                }
            });
            return updated;
        });
    }, [selectedIds]);

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('User database association'),
            href: '#',
        },
    ];

    const updateAttribute = (dbId: number, key: keyof DbProductAttributes, value: any) => {
        setAttributesByDbId(prev => ({
            ...prev,
            [dbId]: {
                ...prev[dbId],
                [key]: value
            }
        }));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('User database association')} />

            <SettingsLayout>
                <Form method="post" action={`/admin/users/${targetUser.id}/db`} className="space-y-4">
                    <Card className="p-6">
                        <div className="flex flex-col gap-6">
                            <FormField label={t('Select DB product')}>
                                <SearchSelect
                                    value={search}
                                    onChange={(v) => setSearch(v)}
                                    onSubmit={(s) => {
                                        const names = s && s.trim() ? s.trim().split(/\s+/) : [];
                                        const ids = (names || []).map((name) => {
                                            const found = (dbProducts as any[]).find((d) => d.name === name);
                                            return found ? found.id : null;
                                        }).filter((v) => v !== null) as number[];
                                        setSelectedIds(ids);
                                    }}
                                    propositions={((dbProducts as any[]) || []).map((d) => d.name)}
                                    selection={initialSelection}
                                    loading={false}
                                    minQueryLength={0}
                                />

                                {/* Hidden inputs for selected ids */}
                                {(selectedIds || []).map((id) => (
                                    <input key={id} type="hidden" name="db_ids[]" value={id} />
                                ))}
                            </FormField>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button disabled={processing} type="submit">{t('Save')}</Button>
                        </div>
                    </Card>

                    {/* Formulaires d'attributs pour chaque DB sélectionné */}
                    {selectedIds.length > 0 && (
                        <div className="mt-6 space-y-4">
                            {selectedIds.map((dbId) => {
                                const db = (dbProducts as any[]).find((d) => d.id === dbId);
                                const attrs = attributesByDbId[dbId] || DEFAULT_ATTRIBUTES;

                                return (
                                    <Card key={dbId}>
                                        <CardHeader>
                                            <CardTitle>{db ? db.name : `DB #${dbId}`}</CardTitle>
                                            {db?.description && (
                                                <CardDescription>{db.description}</CardDescription>
                                            )}
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Section Marges */}
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold">Marges</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <FormField label="Marge générale (%)" htmlFor={`m-${dbId}`}>
                                                        <Input
                                                            id={`m-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.m}
                                                            onChange={(e) => updateAttribute(dbId, 'm', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label="Marge min par roll (€)" htmlFor={`mm-${dbId}`}>
                                                        <Input
                                                            id={`mm-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.mm}
                                                            onChange={(e) => updateAttribute(dbId, 'mm', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label="Marge par carton (%)" htmlFor={`mc-${dbId}`}>
                                                        <Input
                                                            id={`mc-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.mc}
                                                            onChange={(e) => updateAttribute(dbId, 'mc', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label="Marge par étage (%)" htmlFor={`me-${dbId}`}>
                                                        <Input
                                                            id={`me-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.me}
                                                            onChange={(e) => updateAttribute(dbId, 'me', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label="Marge par roll (%)" htmlFor={`mr-${dbId}`}>
                                                        <Input
                                                            id={`mr-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.mr}
                                                            onChange={(e) => updateAttribute(dbId, 'mr', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>
                                                </div>
                                            </div>

                                            <Separator />

                                            {/* Section Prix et Pondération */}
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold">Prix et Pondération</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <FormField label="Mode de prix" htmlFor={`p-${dbId}`}>
                                                        <Select
                                                            value={attrs.p}
                                                            onValueChange={(value) => updateAttribute(dbId, 'p', value)}
                                                        >
                                                            <SelectTrigger id={`p-${dbId}`}>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="-1">Auto (hérite du parent)</SelectItem>
                                                                <SelectItem value="0">Prix départ</SelectItem>
                                                                <SelectItem value="1">Prix rendu</SelectItem>
                                                                <SelectItem value="price">Prix de base</SelectItem>
                                                                <SelectItem value="price_floor">Prix étage</SelectItem>
                                                                <SelectItem value="price_roll">Prix roll</SelectItem>
                                                                <SelectItem value="price_promo">Prix promo</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormField>

                                                    <FormField label="Coefficient de pondération (%)" htmlFor={`pd-${dbId}`}>
                                                        <Input
                                                            id={`pd-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.pd}
                                                            onChange={(e) => updateAttribute(dbId, 'pd', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label="Catégorie de marges" htmlFor={`c-${dbId}`}>
                                                        <Input
                                                            id={`c-${dbId}`}
                                                            type="text"
                                                            value={attrs.c}
                                                            onChange={(e) => updateAttribute(dbId, 'c', e.target.value)}
                                                        />
                                                    </FormField>

                                                    <FormField label="Hausse sur roll" htmlFor={`h-${dbId}`}>
                                                        <Input
                                                            id={`h-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.h}
                                                            onChange={(e) => updateAttribute(dbId, 'h', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>
                                                </div>
                                            </div>

                                            <Separator />

                                            {/* Section Livraison et TVA */}
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold">Livraison et TVA</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <FormField label="Livraison (€)" htmlFor={`l-${dbId}`}>
                                                        <Input
                                                            id={`l-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.l}
                                                            onChange={(e) => updateAttribute(dbId, 'l', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label="TVA produit (%)" htmlFor={`tvap-${dbId}`}>
                                                        <Input
                                                            id={`tvap-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.tvap}
                                                            onChange={(e) => updateAttribute(dbId, 'tvap', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label="TVA transport (%)" htmlFor={`tvat-${dbId}`}>
                                                        <Input
                                                            id={`tvat-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.tvat ?? ''}
                                                            onChange={(e) => updateAttribute(dbId, 'tvat', e.target.value ? parseFloat(e.target.value) : null)}
                                                        />
                                                    </FormField>
                                                </div>
                                            </div>

                                            {/* Champ caché pour envoyer le JSON au backend */}
                                            <input
                                                type="hidden"
                                                name={`attributes[${dbId}]`}
                                                value={JSON.stringify(attrs)}
                                            />
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </Form>
            </SettingsLayout>
        </AppLayout>
    );
}
