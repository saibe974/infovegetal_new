<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
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
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $clientRole = Role::firstOrCreate(['name' => 'client']);
        $guestRole = Role::firstOrCreate(['name' => 'guest']);

        // Créer des permissions (optionnel, pour plus tard)
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
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Assigner toutes les permissions à admin
        $adminRole->syncPermissions(Permission::all());

        // Client peut seulement voir et créer
        $clientRole->syncPermissions([
            'view products',
            'create products',
        ]);

        // Guest peut seulement voir
        $guestRole->syncPermissions([
            'view products',
        ]);

        $this->command->info('Roles and permissions created successfully!');
    }
}
