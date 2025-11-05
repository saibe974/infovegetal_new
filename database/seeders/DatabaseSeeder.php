<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Créer les rôles et permissions d'abord
        $this->call([
            RoleSeeder::class,
        ]);

        // User::factory(10)->create();

        $adminUser = User::firstOrCreate(
            ['email' => '69.hugue@gmail.com'],
            [
                'name' => 'Admin',
                'password' => Hash::make('Admin974'),
                'email_verified_at' => now(),
            ]
        );

        // Assigner le rôle admin au premier utilisateur
        if (!$adminUser->hasRole('admin')) {
            $adminUser->assignRole('admin');
        }
    }
}
