<?php

declare(strict_types=1);

namespace Tests\Feature\Http;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class AuthProductApiResolvedAttributesTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_resolved_db_user_attributes_from_sales_conditions_on_auth_product_api(): void
    {
        $client = User::factory()->withoutTwoFactor()->create();
        $billingUser = User::factory()->withoutTwoFactor()->create();

        $dbProductId = DB::table('db_products')->insertGetId([
            'name' => 'db-product-auth-api-resolved-attrs',
            'description' => null,
            'champs' => null,
            'categories' => null,
            'country' => 'FR',
            'mod_liv' => 'roll',
            'mini' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('db_product_billing_user')->insert([
            'db_product_id' => $dbProductId,
            'billing_user_id' => $billingUser->id,
            'defaults' => json_encode([
                'default_profile_id' => 'base',
                'profiles' => [
                    ['id' => 'base', 'conditions' => ['m' => 0]],
                ],
            ]),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('client_sales_conditions')->insert([
            'client_user_id' => $client->id,
            'db_product_id' => $dbProductId,
            'billing_user_id' => $billingUser->id,
            'seller_user_id' => null,
            'conditions_override' => json_encode([
                'l' => 171.25,
                'lm' => 342.5,
                'p' => 'price_render',
                't' => '[{"carrier_id":1,"zone_id":309}]',
                'z' => 309,
                'tvat' => 0,
            ]),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $product = Product::create([
            'sku' => 'auth-api-resolved-attrs',
            'name' => 'Auth API resolved attrs',
            'description' => null,
            'img_link' => null,
            'price' => 10,
            'active' => true,
            'attributes' => [],
            'category_products_id' => null,
            'db_products_id' => $dbProductId,
            'ref' => 'auth-api-resolved-attrs',
            'ean13' => '1234567890123',
            'pot' => null,
            'height' => null,
            'price_floor' => 8,
            'price_roll' => 7,
            'price_promo' => 0,
            'producer_id' => null,
            'tva_id' => null,
            'cond' => 2,
            'floor' => 2,
            'roll' => 3,
            'unite' => null,
        ]);

        $response = $this->actingAs($client)->getJson('/api/auth/products/' . $product->id);

        $response
            ->assertOk()
            ->assertJsonPath('db_user_attributes.l', 171.25)
            ->assertJsonPath('db_user_attributes.lm', 342.5)
            ->assertJsonPath('db_user_attributes.z', 309)
            ->assertJsonPath('db_user_attributes.p', 'price_render');
    }
}
