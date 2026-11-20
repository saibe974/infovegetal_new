<?php

use Inertia\Testing\AssertableInertia;

it('exposes the producer and letter filters on the home page', function (): void {
    $this->get('/?producer[]=1&letter=a')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('home')
            ->where('filters.producer', ['1'])
            ->where('filters.letter', 'A')
            ->has('producerOptions')
            ->has('letterOptions'));
});
