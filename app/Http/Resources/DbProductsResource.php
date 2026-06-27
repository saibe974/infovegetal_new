<?php

namespace App\Http\Resources;

use App\Models\DbProductBillingUser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DbProductsResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $billingUsers = [];

        if ($this->relationLoaded('billingRules')) {
            $billingUsers = $this->billingRules
                ->filter(fn (DbProductBillingUser $rule) => (bool) ($rule->active ?? true))
                ->map(function (DbProductBillingUser $rule) {
                    $billingUser = $rule->relationLoaded('billingUser') ? $rule->billingUser : null;

                    if (!$billingUser) {
                        return null;
                    }

                    $sellers = $billingUser->relationLoaded('sellers')
                        ? $billingUser->sellers
                            ->filter(fn ($seller) => (bool) ($seller->pivot?->active ?? true))
                            ->map(function ($seller) {
                                $override = $seller->pivot?->conditions_override;

                                if (is_string($override)) {
                                    $decoded = json_decode($override, true);
                                    $override = is_array($decoded) ? $decoded : [];
                                }

                                return [
                                    'id' => (int) $seller->id,
                                    'name' => (string) $seller->name,
                                    'email' => (string) ($seller->email ?? ''),
                                    'conditions_override' => is_array($override) ? $override : [],
                                ];
                            })
                            ->values()
                            ->all()
                        : [];

                    return [
                        'id' => (int) $billingUser->id,
                        'name' => (string) $billingUser->name,
                        'email' => (string) ($billingUser->email ?? ''),
                        'defaults' => $rule->defaults,
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
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
