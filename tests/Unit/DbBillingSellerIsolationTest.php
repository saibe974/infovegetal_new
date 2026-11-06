<?php

use App\Http\Resources\DbProductsResource;
use App\Models\DbProductBillingUser;
use App\Models\DbProducts;
use App\Models\DbProductSellerUser;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

it('lists only active sellers assigned to the current database and billing user', function () {
    $seller = new User(['name' => 'Commercial', 'email' => 'seller@example.test']);
    $seller->id = 30;
    $billingUser = new User(['name' => 'Facturant']);
    $billingUser->id = 20;
    // A global link must neither add a seller to another DB nor hide a local assignment.
    $billingUser->setRelation('sellers', new Collection);

    $serialize = function (int $databaseId, bool $active, int $billingId = 20) use ($seller, $billingUser) {
        $db = new DbProducts;
        $db->id = $databaseId;
        $billing = new DbProductBillingUser(['billing_user_id' => 20, 'active' => true]);
        $billing->setRelation('billingUser', $billingUser);
        $rule = new DbProductSellerUser([
            'db_product_id' => $databaseId,
            'billing_user_id' => $billingId,
            'seller_user_id' => 30,
            'active' => $active,
            'conditions' => ['margin' => 12],
        ]);
        $rule->setRelation('sellerUser', $seller);
        $db->setRelation('billingRules', new Collection([$billing]));
        $db->setRelation('sellerRules', new Collection([$rule]));

        return (new DbProductsResource($db))->toArray(Request::create('/'))['billing_users'][0]['sellers'];
    };

    expect($serialize(1, true))->toHaveCount(1)
        ->and($serialize(1, true)[0]['conditions'])->toBe(['margin' => 12])
        ->and($serialize(2, false))->toBe([])
        ->and($serialize(2, true, 99))->toBe([]);

    $billingUser->setRelation('sellers', new Collection([$seller]));
    expect($serialize(2, false))->toBe([])
        ->and($serialize(1, true))->toHaveCount(1);
});
