<?php

namespace App\Http\Resources;

use App\Models\DbProductBillingUser;
use App\Models\DbProductSellerUser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

class DbProductsResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $actor = $request->user();
        $canManageAll = $actor
            && (
                $actor->hasRole('admin')
                || $actor->hasRole('dev')
                || $actor->getAllPermissions()->contains('name', 'users.db_products.manage.all')
            );
        $canManageFromPivot = $this->relationLoaded('users')
            ? $this->users->contains(fn ($user) => $actor && (int) $user->id === (int) $actor->id && (bool) ($user->pivot?->can_manage ?? false))
            : false;
        $canManage = (bool) ($canManageAll || $canManageFromPivot);
        $canBilling = $canManage || $this->canViewBilling($actor);

        $sellerManageById = [];
        if ($this->relationLoaded('users')) {
            foreach ($this->users as $dbUser) {
                $sellerManageById[(int) $dbUser->id] = (bool) ($dbUser->pivot?->can_manage ?? false);
            }
        }

        $billingUsers = [];

        $sellerRuleByKey = [];
        if ($this->relationLoaded('sellerRules')) {
            foreach ($this->sellerRules as $sellerRule) {
                if (!$sellerRule instanceof DbProductSellerUser || !(bool) ($sellerRule->active ?? true)) {
                    continue;
                }

                $key = sprintf('%d:%d', (int) ($sellerRule->billing_user_id ?? 0), (int) ($sellerRule->seller_user_id ?? 0));
                $sellerRuleByKey[$key] = [
                    'conditions' => is_array($sellerRule->conditions) ? $sellerRule->conditions : [],
                    'use_billing_profile' => (bool) ($sellerRule->use_billing_profile ?? true),
                    'billing_profile_id' => isset($sellerRule->billing_profile_id) ? (string) $sellerRule->billing_profile_id : null,
                    'seller_defaults' => $this->normalizeBillingDefaults($sellerRule->seller_defaults),
                    'can_manage' => (bool) ($sellerRule->can_manage ?? false),
                ];
            }
        }

        if ($this->relationLoaded('billingRules')) {
            $billingUsers = $this->billingRules
                ->filter(fn (DbProductBillingUser $rule) => (bool) ($rule->active ?? true))
                ->map(function (DbProductBillingUser $rule) use ($sellerManageById, $sellerRuleByKey) {
                    $billingUser = $rule->relationLoaded('billingUser') ? $rule->billingUser : null;

                    if (!$billingUser) {
                        return null;
                    }

                    $sellers = $billingUser->relationLoaded('sellers')
                        ? $billingUser->sellers
                            ->filter(fn ($seller) => (bool) ($seller->pivot?->active ?? true))
                            ->map(function ($seller) use ($sellerManageById, $billingUser, $sellerRuleByKey) {

                                $sellerDefaultsKey = sprintf('%d:%d', (int) ($billingUser->id ?? 0), (int) $seller->id);
                                $sellerRule = $sellerRuleByKey[$sellerDefaultsKey] ?? [
                                    'conditions' => [],
                                    'use_billing_profile' => true,
                                    'billing_profile_id' => null,
                                    'seller_defaults' => [
                                        'profiles' => [],
                                        'default_profile_id' => null,
                                    ],
                                    'can_manage' => false,
                                ];

                                return [
                                    'id' => (int) $seller->id,
                                    'name' => (string) $seller->name,
                                    'email' => (string) ($seller->email ?? ''),
                                    'conditions' => $sellerRule['conditions'],
                                    'use_billing_profile' => (bool) $sellerRule['use_billing_profile'],
                                    'billing_profile_id' => $sellerRule['billing_profile_id'],
                                    'seller_defaults' => $sellerRule['seller_defaults'],
                                    'can_manage' => (bool) ($sellerRule['can_manage'] ?? $sellerManageById[(int) $seller->id] ?? false),
                                ];
                            })
                            ->values()
                            ->all()
                        : [];

                    return [
                        'id' => (int) $billingUser->id,
                        'name' => (string) $billingUser->name,
                        'email' => (string) ($billingUser->email ?? ''),
                        'defaults' => $this->normalizeBillingDefaults($rule->defaults),
                        'sellers' => $sellers,
                    ];
                })
                ->filter()
                ->values()
                ->all();
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'defaults' => $this->defaults,
            'champs' => $this->champs,
            'categories' => $this->categories,
            'traitement' => $this->traitement,
            'header_row_index' => $this->header_row_index,
            'source_delimiter' => $this->source_delimiter,
            'mergins' => $this->mergins,
            'country' => $this->country,
            'mod_liv' => $this->mod_liv,
            'mini' => $this->mini,
            'billing_users' => $billingUsers,
            'billable_user_ids' => $this->relationLoaded('users')
                ? $this->users
                    ->filter(fn ($user) => (bool) ($user->pivot?->can_sell ?? false))
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->values()
                    ->all()
                : [],
            'manageable_user_ids' => $this->relationLoaded('users')
                ? $this->users
                    ->filter(fn ($user) => (bool) ($user->pivot?->can_manage ?? false))
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->values()
                    ->all()
                : [],
            'abilities' => [
                'update' => $canManage,
                'manage' => $canManage,
                'delete' => $canManage,
                'billing' => $canBilling,
            ],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    private function canViewBilling(mixed $actor): bool
    {
        if (!$actor || !isset($this->id)) {
            return false;
        }

        $actorId = (int) ($actor->id ?? 0);
        if ($actorId <= 0) {
            return false;
        }

        $isBillingUser = DbProductBillingUser::query()
            ->where('db_product_id', (int) $this->id)
            ->where('billing_user_id', $actorId)
            ->where('active', true)
            ->exists();

        if ($isBillingUser) {
            return true;
        }

        $isDirectSeller = DbProductSellerUser::query()
            ->where('db_product_id', (int) $this->id)
            ->where('seller_user_id', $actorId)
            ->where('active', true)
            ->exists();

        if ($isDirectSeller) {
            return true;
        }

        return DB::table('db_product_billing_user as dbu')
            ->join('billing_user_seller_user as bs', 'bs.billing_user_id', '=', 'dbu.billing_user_id')
            ->where('dbu.db_product_id', (int) $this->id)
            ->where('dbu.active', true)
            ->where('bs.seller_user_id', $actorId)
            ->where('bs.active', true)
            ->exists();
    }

    private function normalizeBillingDefaults(mixed $defaults): array
    {
        if (!is_array($defaults)) {
            return [
                'profiles' => [],
                'default_profile_id' => null,
            ];
        }

        $profiles = $defaults['profiles'] ?? null;
        if (is_array($profiles)) {
            return [
                'profiles' => collect($profiles)
                    ->filter(fn ($profile) => is_array($profile))
                    ->map(function ($profile) {
                        return [
                            'id' => (string) ($profile['id'] ?? 'standard'),
                            'name' => (string) ($profile['name'] ?? 'Standard'),
                            'conditions' => is_array($profile['conditions'] ?? null) ? $profile['conditions'] : [],
                        ];
                    })
                    ->values()
                    ->all(),
                'default_profile_id' => isset($defaults['default_profile_id'])
                    ? (string) $defaults['default_profile_id']
                    : null,
            ];
        }

        return [
            'profiles' => [
                [
                    'id' => 'standard',
                    'name' => 'Standard',
                    'conditions' => $defaults,
                ],
            ],
            'default_profile_id' => 'standard',
        ];
    }
}
