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
        // User::factory(10)->create();

        User::firstOrCreate(
            ['email' => '69.hugue@gmail.com'],
            [
                'name' => 'Admin',
                'password' => Hash::make('Admin974'),
                'email_verified_at' => now(),
            ]
        );
    }
}
