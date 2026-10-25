import { OrderStatusBadge } from '@/components/cart/order-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { formatCurrency } from '@/lib/utils';
import type { SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

type Line = {
    product_id: number;
    name: string;
    ref: string;
    quantity: number;
    ordered_quantity: number;
    shipped_quantity?: number;
    accepted_quantity: number;
    unit_price: number;
    can_edit: boolean;
    client_comment?: string;
    billing_user_id: number | null;
};
type Issue = {
    id: number;
    product_id: number;
    kind: string;
    quantity: number;
    comment: string;
    status: string;
    user: { name: string };
    reviewer?: { name: string };
    resolution?: string;
};
type Order = {
    id: number;
    number: string;
    status: string;
    status_label: string;
    revision: number;
    client: { id: number; name: string; ref: string };
    comment?: string;
    lines: Line[];
    comments: {
        id: number;
        body: string;
        product_id?: number;
        author_role: string;
        created_at: string;
        user: { name: string };
    }[];
    issues: Issue[];
    documents: {
        id: number;
        kind: string;
        number: string;
        issued_at: string;
        issuer_id: number;
    }[];
};
type Props = {
    order: Order;
    can_manage: boolean;
    can_invoice: boolean;
    can_report: boolean;
    numbering: { pattern: string; preview: string };
};
const documentLabels: Record<string, string> = {
    delivery: 'Bon de livraison',
    invoice: 'Facture',
    credit: 'Avoir',
};

export default function Show({
    order,
    can_manage,
    can_invoice,
    can_report,
    numbering,
}: Props) {
    const { auth } = usePage<SharedData>().props;
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [body, setBody] = useState('');
    const [commentProduct, setCommentProduct] = useState('');
    const [pattern, setPattern] = useState(numbering.pattern);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<
        { id: number; name: string; ref: string }[]
    >([]);
    const [added, setAdded] = useState<{ id: number; name: string }[]>([]);
    const [report, setReport] = useState({
        product_id: '',
        kind: 'missing',
        quantity: 1,
        comment: '',
    });
    const [resolutions, setResolutions] = useState<Record<number, string>>({});
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const base = `/orders/${order.id}`;
    const changed =
        added.length > 0 ||
        order.lines.some(
            (line) =>
                quantities[line.product_id] !== undefined &&
                quantities[line.product_id] !== line.quantity,
        );
    useEffect(() => {
        setQuantities({});
        setAdded([]);
    }, [order.id]);
    useEffect(() => {
        if (search.trim().length < 2) {
            setResults([]);
            return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            fetch(`${base}/products?q=${encodeURIComponent(search)}`, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            })
                .then((r) => (r.ok ? r.json() : []))
                .then(setResults)
                .catch(() => {});
        }, 250);
        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [search, base]);
    const send = (
        path: string,
        data: Record<string, unknown>,
        method: 'post' | 'put' = 'post',
        done?: () => void,
    ) => {
        setErrors([]);
        router[method](
            `${base}/${path}`,
            { revision: order.revision, ...data },
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onError: (e) => setErrors(Object.values(e).map(String)),
                onSuccess: () => done?.(),
            },
        );
    };
    const action = (value: string) => send('actions', { action: value });
    const invoice = order.documents.find(
        (d) => d.kind === 'invoice' && d.issuer_id === auth.user?.id,
    );
    const hasPending = order.issues.some((i) => i.status === 'pending');
    const canReview = (issue: Issue) =>
        order.lines.find((l) => l.product_id === issue.product_id)?.can_edit;

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Commandes', href: '/dashboard' },
                { title: `Commande ${order.number}`, href: base },
            ]}
        >
            <Head title={`Commande ${order.number}`} />
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
                <div>
                    <Link href="/dashboard" className="text-sm underline">
                        Retour aux commandes
                    </Link>
                    <h1 className="mt-3 text-2xl font-semibold">
                        Commande {order.number}
                    </h1>
                    <p className="text-muted-foreground">
                        {order.client.name} · {order.client.ref} ·{' '}
                        <OrderStatusBadge
                            status={order.status}
                            label={order.status_label}
                        />
                    </p>
                </div>
                {errors.length > 0 && (
                    <div
                        role="alert"
                        className="rounded-lg border border-red-300 p-4 text-red-700"
                    >
                        {errors.map((error, i) => (
                            <p key={i}>{error}</p>
                        ))}
                        <Button
                            className="mt-2"
                            variant="outline"
                            onClick={() => router.reload()}
                        >
                            Actualiser la commande
                        </Button>
                    </div>
                )}
                {order.status === 'processing' && (
                    <p className="rounded-lg bg-muted p-4 text-sm">
                        Commande transmise. Le client peut la consulter et
                        commenter. Le facturant et le commercial peuvent
                        préparer les produits avant d’établir le bon de
                        livraison.
                    </p>
                )}
                <section className="overflow-x-auto rounded-lg border p-4">
                    <h2 className="mb-4 text-lg font-semibold">Produits</h2>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="p-2">Produit</th>
                                <th className="p-2">Commandée</th>
                                <th className="p-2">Préparée</th>
                                <th className="p-2">Expédiée</th>
                                <th className="p-2">Retenue</th>
                                <th className="p-2">PU HT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.lines.map((line) => (
                                <tr key={line.product_id} className="border-b">
                                    <td className="p-2">
                                        {line.name}
                                        <span className="block text-muted-foreground">
                                            {line.ref}
                                        </span>
                                        {line.client_comment && (
                                            <p className="mt-1">
                                                Client : {line.client_comment}
                                            </p>
                                        )}
                                    </td>
                                    <td className="p-2">
                                        {line.ordered_quantity}
                                    </td>
                                    <td className="p-2">
                                        {order.status === 'processing' &&
                                        line.can_edit ? (
                                            <Input
                                                aria-label={`Quantité préparée : ${line.name}`}
                                                type="number"
                                                min={0}
                                                max={1000000}
                                                className="w-24"
                                                value={
                                                    quantities[
                                                        line.product_id
                                                    ] ?? line.quantity
                                                }
                                                onChange={(e) =>
                                                    setQuantities({
                                                        ...quantities,
                                                        [line.product_id]:
                                                            Number(
                                                                e.target.value,
                                                            ),
                                                    })
                                                }
                                            />
                                        ) : (
                                            line.quantity
                                        )}
                                    </td>
                                    <td className="p-2">
                                        {line.shipped_quantity ?? '—'}
                                    </td>
                                    <td className="p-2">
                                        {line.shipped_quantity !== undefined
                                            ? line.accepted_quantity
                                            : '—'}
                                    </td>
                                    <td className="p-2">
                                        {formatCurrency(line.unit_price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {can_manage && order.status === 'processing' && (
                        <div className="mt-4 space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Pour retirer un produit, mettez sa quantité
                                préparée à zéro. Les quantités initiales restent
                                conservées.
                            </p>
                            <Input
                                aria-label="Rechercher un produit à ajouter"
                                placeholder="Ajouter un produit : nom ou référence…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {results.map((product) => (
                                <Button
                                    key={product.id}
                                    variant="outline"
                                    className="mr-2 mb-2"
                                    disabled={
                                        order.lines.some(
                                            (l) => l.product_id === product.id,
                                        ) ||
                                        added.some((l) => l.id === product.id)
                                    }
                                    onClick={() => {
                                        setAdded([...added, product]);
                                        setQuantities({
                                            ...quantities,
                                            [product.id]: 1,
                                        });
                                        setSearch('');
                                    }}
                                >
                                    Ajouter {product.name} ({product.ref})
                                </Button>
                            ))}
                            {added.map((product) => (
                                <div
                                    key={product.id}
                                    className="flex items-center gap-3"
                                >
                                    <span>{product.name}</span>
                                    <Input
                                        aria-label={`Quantité : ${product.name}`}
                                        type="number"
                                        min={0}
                                        className="w-24"
                                        value={quantities[product.id] ?? 1}
                                        onChange={(e) =>
                                            setQuantities({
                                                ...quantities,
                                                [product.id]: Number(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                    />
                                    <Button
                                        variant="ghost"
                                        onClick={() =>
                                            setAdded(
                                                added.filter(
                                                    (p) => p.id !== product.id,
                                                ),
                                            )
                                        }
                                    >
                                        Retirer
                                    </Button>
                                </div>
                            ))}
                            <Button
                                disabled={busy || !changed}
                                onClick={() =>
                                    send(
                                        'lines',
                                        {
                                            lines: [
                                                ...order.lines
                                                    .filter((l) => l.can_edit)
                                                    .map((l) => ({
                                                        product_id:
                                                            l.product_id,
                                                        quantity:
                                                            quantities[
                                                                l.product_id
                                                            ] ?? l.quantity,
                                                    })),
                                                ...added.map((p) => ({
                                                    product_id: p.id,
                                                    quantity:
                                                        quantities[p.id] ?? 1,
                                                })),
                                            ],
                                        },
                                        'put',
                                        () => {
                                            setQuantities({});
                                            setAdded([]);
                                        },
                                    )
                                }
                            >
                                Enregistrer les modifications
                            </Button>
                        </div>
                    )}
                </section>
                {can_manage && (
                    <div className="flex flex-wrap gap-3">
                        {order.status === 'processing' && (
                            <Button
                                disabled={busy || changed}
                                onClick={() => action('ship')}
                            >
                                Valider et établir le bon de livraison
                            </Button>
                        )}
                        {order.status === 'delivering' && (
                            <Button
                                disabled={busy}
                                onClick={() => action('deliver')}
                            >
                                Confirmer la livraison
                            </Button>
                        )}
                        {order.status === 'delivered' &&
                            can_invoice &&
                            !invoice && (
                                <Button
                                    disabled={busy || hasPending}
                                    onClick={() => action('invoice')}
                                >
                                    Émettre la facture
                                </Button>
                            )}
                        {order.status === 'delivered' &&
                            invoice &&
                            can_invoice && (
                                <Button
                                    disabled={busy}
                                    onClick={() => action('credit')}
                                >
                                    Émettre l’avoir pour les écarts validés
                                </Button>
                            )}
                        {order.status === 'delivered' && (
                            <Button
                                variant="outline"
                                disabled={busy || hasPending}
                                onClick={() => action('close')}
                            >
                                Clôturer la commande
                            </Button>
                        )}
                        {changed && (
                            <p className="text-sm">
                                Enregistrez les modifications avant de valider
                                la livraison.
                            </p>
                        )}
                    </div>
                )}
                <section className="rounded-lg border p-4">
                    <h2 className="mb-3 text-lg font-semibold">Documents</h2>
                    <p className="mb-3">
                        <a
                            className="underline"
                            href={`/order-files/cart/${order.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Bon de commande initial
                        </a>
                    </p>
                    {order.documents.length === 0 && (
                        <p className="text-muted-foreground">
                            Aucun document de livraison ou de facturation émis.
                        </p>
                    )}
                    {order.documents.map((doc) => (
                        <p key={doc.id} className="mb-2">
                            <a
                                className="underline"
                                href={`${base}/documents/${doc.id}`}
                            >
                                {documentLabels[doc.kind]} {doc.number}
                            </a>{' '}
                            ·{' '}
                            {new Date(doc.issued_at).toLocaleDateString(
                                'fr-FR',
                            )}
                        </p>
                    ))}
                    <p className="mt-2 text-sm text-muted-foreground">
                        Les documents émis conservent leur contenu.
                        Téléchargez-les pour les transmettre au client.
                    </p>
                </section>
                {can_invoice && (
                    <section className="space-y-3 rounded-lg border p-4">
                        <h2 className="text-lg font-semibold">
                            Numérotation de mes factures
                        </h2>
                        <p className="text-sm">
                            Ce format s’applique à vos prochaines factures, pour
                            tous vos clients.
                        </p>
                        <Input
                            aria-label="Format de numéro de facture"
                            value={pattern}
                            maxLength={150}
                            onChange={(e) => setPattern(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                            Variables : %date%, %annee%, %ref_client%,
                            %n°commande%, %compteur%. Le compteur continue sans
                            remise à zéro.
                        </p>
                        <p className="text-sm">
                            Aperçu du format enregistré :{' '}
                            <strong>{numbering.preview}</strong>
                        </p>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                                send('numbering', { pattern }, 'put')
                            }
                        >
                            Enregistrer mon format
                        </Button>
                    </section>
                )}
                <section className="space-y-4 rounded-lg border p-4">
                    <h2 className="text-lg font-semibold">
                        Signalements après livraison
                    </h2>
                    {order.issues.length === 0 && (
                        <p className="text-muted-foreground">
                            Aucun signalement.
                        </p>
                    )}
                    {order.issues.map((issue) => (
                        <div
                            key={issue.id}
                            className="space-y-2 rounded border p-3"
                        >
                            <p>
                                <strong>
                                    {
                                        order.lines.find(
                                            (l) =>
                                                l.product_id ===
                                                issue.product_id,
                                        )?.name
                                    }
                                </strong>{' '}
                                · {issue.quantity}{' '}
                                {issue.kind === 'missing'
                                    ? 'manquant(s)'
                                    : 'abîmé(s)'}{' '}
                                ·{' '}
                                {
                                    {
                                        pending: 'À valider',
                                        approved: 'Validé',
                                        rejected: 'Refusé',
                                    }[
                                        issue.status as
                                            | 'pending'
                                            | 'approved'
                                            | 'rejected'
                                    ]
                                }
                            </p>
                            <p>
                                {issue.user.name} : {issue.comment}
                            </p>
                            {issue.resolution && (
                                <p>
                                    {issue.reviewer?.name} : {issue.resolution}
                                </p>
                            )}
                            {issue.status === 'pending' && canReview(issue) && (
                                <>
                                    <textarea
                                        className="w-full rounded-md border bg-background p-3 text-sm"
                                        aria-label="Motif de la décision"
                                        placeholder="Commentaire de validation ou de refus"
                                        maxLength={2000}
                                        value={resolutions[issue.id] ?? ''}
                                        onChange={(e) =>
                                            setResolutions({
                                                ...resolutions,
                                                [issue.id]: e.target.value,
                                            })
                                        }
                                    />
                                    <div className="flex gap-2">
                                        {['approved', 'rejected'].map(
                                            (status) => (
                                                <Button
                                                    key={status}
                                                    variant="outline"
                                                    disabled={
                                                        busy ||
                                                        !resolutions[
                                                            issue.id
                                                        ]?.trim()
                                                    }
                                                    onClick={() =>
                                                        send(
                                                            `issues/${issue.id}`,
                                                            {
                                                                status,
                                                                resolution:
                                                                    resolutions[
                                                                        issue.id
                                                                    ],
                                                            },
                                                            'put',
                                                        )
                                                    }
                                                >
                                                    {status === 'approved'
                                                        ? 'Valider'
                                                        : 'Refuser'}
                                                </Button>
                                            ),
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {can_report && order.status === 'delivered' && (
                        <form
                            className="space-y-3"
                            onSubmit={(e) => {
                                e.preventDefault();
                                send(
                                    'issues',
                                    {
                                        ...report,
                                        product_id: Number(report.product_id),
                                    },
                                    'post',
                                    () =>
                                        setReport({
                                            product_id: '',
                                            kind: 'missing',
                                            quantity: 1,
                                            comment: '',
                                        }),
                                );
                            }}
                        >
                            <p className="text-sm">
                                Un facturant ou un commercial doit valider le
                                signalement avant toute correction.
                            </p>
                            <Select
                                required
                                value={report.product_id}
                                onValueChange={(value) =>
                                    setReport({
                                        ...report,
                                        product_id: value,
                                    })
                                }
                            >
                                <SelectTrigger aria-label="Produit concerné">
                                    <SelectValue placeholder="Choisir le produit" />
                                </SelectTrigger>
                                <SelectContent>
                                    {order.lines
                                        .filter(
                                            (l) =>
                                                (l.shipped_quantity ?? 0) > 0 &&
                                                (l.can_edit ||
                                                    auth.user?.id ===
                                                        order.client?.id),
                                        )
                                        .map((l) => (
                                            <SelectItem
                                                key={l.product_id}
                                                value={String(l.product_id)}
                                            >
                                                {l.name}
                                                {l.ref ? ` (${l.ref})` : ''}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={report.kind}
                                onValueChange={(value) =>
                                    setReport({
                                        ...report,
                                        kind: value,
                                    })
                                }
                            >
                                <SelectTrigger aria-label="Type de problème">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="missing">
                                        Produit manquant
                                    </SelectItem>
                                    <SelectItem value="damaged">
                                        Produit abîmé
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                aria-label="Quantité concernée"
                                required
                                type="number"
                                min={1}
                                max={1000000}
                                value={report.quantity}
                                onChange={(e) =>
                                    setReport({
                                        ...report,
                                        quantity: Number(e.target.value),
                                    })
                                }
                            />
                            <textarea
                                className="w-full rounded-md border bg-background p-3 text-sm"
                                aria-label="Description du problème"
                                required
                                placeholder="Précisez le problème…"
                                maxLength={2000}
                                value={report.comment}
                                onChange={(e) =>
                                    setReport({
                                        ...report,
                                        comment: e.target.value,
                                    })
                                }
                            />
                            <Button disabled={busy}>
                                Signaler le problème
                            </Button>
                        </form>
                    )}
                </section>
                <section className="space-y-4 rounded-lg border p-4">
                    <h2 className="text-lg font-semibold">
                        Commentaires — visibles par tous les intervenants
                    </h2>
                    {order.comment && (
                        <p className="rounded bg-muted p-3">
                            Commentaire initial du client : {order.comment}
                        </p>
                    )}
                    {order.comments.map((comment) => (
                        <div key={comment.id} className="rounded border p-3">
                            <p className="text-sm text-muted-foreground">
                                {comment.user.name} · {comment.author_role} ·{' '}
                                {new Date(comment.created_at).toLocaleString(
                                    'fr-FR',
                                )}
                                {comment.product_id
                                    ? ` · ${order.lines.find((l) => l.product_id === comment.product_id)?.name}`
                                    : ''}
                            </p>
                            <p className="whitespace-pre-wrap">
                                {comment.body}
                            </p>
                        </div>
                    ))}
                    {can_report && (
                        <form
                            className="space-y-3"
                            onSubmit={(e) => {
                                e.preventDefault();
                                send(
                                    'comments',
                                    {
                                        body,
                                        product_id: commentProduct
                                            ? Number(commentProduct)
                                            : null,
                                    },
                                    'post',
                                    () => setBody(''),
                                );
                            }}
                        >
                            <Select
                                value={commentProduct || 'all'}
                                onValueChange={(value) =>
                                    setCommentProduct(
                                        value === 'all' ? '' : value,
                                    )
                                }
                            >
                                <SelectTrigger aria-label="Portée du commentaire">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Toute la commande
                                    </SelectItem>
                                    {order.lines.map((line) => (
                                        <SelectItem
                                            key={line.product_id}
                                            value={String(line.product_id)}
                                        >
                                            {line.name}
                                            {line.ref ? ` (${line.ref})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <textarea
                                className="w-full rounded-md border bg-background p-3 text-sm"
                                aria-label="Nouveau commentaire"
                                required
                                maxLength={2000}
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Ajouter un commentaire visible par tous…"
                            />
                            <Button disabled={busy || !body.trim()}>
                                Ajouter le commentaire
                            </Button>
                        </form>
                    )}
                </section>
            </div>
        </AppLayout>
    );
}
