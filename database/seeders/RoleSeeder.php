<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Créer les rôles
        $devRole = Role::firstOrCreate(['name' => 'dev']);
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $commercialRole = Role::firstOrCreate(['name' => 'commercial']);
        $supplierRole = Role::firstOrCreate(['name' => 'supplier']);
        $clientRole = Role::firstOrCreate(['name' => 'client']);
        $guestRole = Role::firstOrCreate(['name' => 'guest']);

        // Créer des permissions (optionnel)
        $permissions = [
            'view products',
            'create products',
            'edit products',
            'delete products',
            'import products',
            'export products',
            'manage categories',
            'manage tags',
            'manage users',
            'view all products',
            'view own products only',
            'view gencod products',
            'view all prices',
            'view package prices only',
            'view own prices only',
            'update all prices',
            'update own prices only',
            'export/import products',
            'export/import own products only',
            'place orders',
            'register orders',
            'invoice orders',
            'view all orders',
            'view own orders', 
            'create clients',
            'create suppliers',
            'create adminstrators',
            'create commercials',
            'create guests',
            'link commercials suppliers',
            'link commercials clients',
            'preview',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Assigner toutes les permissions à developer
        $devRole->syncPermissions(Permission::all());

        // Assigner toutes les permissions à admin sauf preview...
        $adminRole->syncPermissions(Permission::all()->reject(fn($p) => in_array($p->name, [
            'preview'
        ])));

        // Client peut seulement voir et créer des produits, voir ses propres prix, enregistrer une commande
        $clientRole->syncPermissions([
            'view products',
            'create products',
            'view own prices only',
            'view gencod products',
            'view own prices only',
            'place orders',
            'register orders',
            'view own orders',
            'create guests',
        ]);

         // Commercial peut tout faire avec ses fournisseurs de rattachement
        $commercialRole->syncPermissions([
            'view products',
            'create products',
            'edit products',
            'delete products',
            'import products',
            'export products',
            'manage categories',
            'manage tags',
            'manage users',
            'view own products only',
            'view gencod products',
            'view own prices only',
            'update all prices',
            'update own prices only',
            'export/import own products only',
            'place orders',
            'register orders',
            'invoice orders',
            'view own orders', 
            'create clients',
            'create guests',
        ]);

        // Fournisseur peut travailler avec produits et ses commerciaux
        $supplierRole->syncPermissions([
            'view products',
            'create products',
            'edit products',
            'delete products',
            'import products',
            'export products',
            'manage categories',
            'manage tags',
            'manage users',
            'view own products only',
            'view gencod products',
            'view own prices only',
            'update all prices',
            'update own prices only',
            'export/import own products only',
            'place orders',
            'register orders',
            'view own orders', 
            'create guests',
        ]);


        // Guest peut seulement voir et simuler une commande
        $guestRole->syncPermissions([
            'view products',
            'view all products',
            'view package prices only',
            'place orders',
            'create guests',
        ]);

        // log output
        // $this->command->info('Roles and permissions created successfully!');
    }
}
