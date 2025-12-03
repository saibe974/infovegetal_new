<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
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


        /* Créer un utilisateur développeur */
        // $dev = User::firstOrCreate(
        //     ['email' => 'dev@dev.com'],
        //     [
        //         'name' => 'Developer',
        //         'password' => Hash::make('dev1234'),
        //         'email_verified_at' => now(),
        //     ]
        // );

        // // Assigner le rôle de dev
        // if (!$dev->hasRole('dev')) {
        //     $dev->assignRole('dev');
        // }
        


        // Créer un utilisateur admin       
        $adminUser = User::firstOrCreate(
            ['email' => 'admin@admin.com'],
            [
                'name' => 'Admin',
                'password' => Hash::make('admin1234'),
                'email_verified_at' => now(),
            ]
        );

        if (!$adminUser->hasRole('admin')) {
            $adminUser->assignRole('admin');
        }
        


        $clientUser = User::firstOrCreate(
            ['email' => 'client@client.com'],
            [
                'name' => 'Client',
                'password' => Hash::make('client123'),
                'email_verified_at' => now(),
            ]
        );

        // Assigner le rôle client
        if (!$clientUser->hasRole('client')) {
            $clientUser->assignRole('client');
        }


        
        $guest = User::firstOrCreate(
            ['email' => 'guest@guest.com'],
            [
                'name' => 'Guest',
                'password' => Hash::make('guest123'),
                'email_verified_at' => now(),
            ]
        );

        // Assigner le rôle guest
        if (!$guest->hasRole('guest')) {
            $guest->assignRole('guest');
        }
    }
}
