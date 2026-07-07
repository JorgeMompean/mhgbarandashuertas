/**
 * @file
 * Gulp build system for Velantis theme + custom modules.
 *
 * Tasks:
 *   gulp build   — Compile all SCSS + JS
 *   gulp watch   — Watch for changes, recompile + clear Drupal cache
 *   gulp         — Alias for build
 */

'use strict';

const { src, dest, watch, series, parallel } = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const sourcemaps = require('gulp-sourcemaps');
const terser = require('gulp-terser');
const { exec } = require('child_process');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const THEME = '.';

const paths = {
  // Theme: base styles (tokens, reset, typography, layout)
  themeBase: {
    src: `${THEME}/scss/base/**/*.scss`,
    dest: `${THEME}/css/base/`,
  },
  // Theme: component styles (header, footer, sections…)
  themeComponents: {
    src: `${THEME}/scss/components/**/*.scss`,
    dest: `${THEME}/css/components/`,
  },
  // SDC components (each *.scss next to its .twig)
  sdc: {
    src: `${THEME}/components/**/*.scss`,
    dest: `${THEME}/components/`,
  },
  // Theme JS
  themeJs: {
    src: `${THEME}/js/src/**/*.js`,
    dest: `${THEME}/js/dist/`,
  },
  // Shared SCSS partials (for @use)
  partials: `${THEME}/scss`,
};

// ---------------------------------------------------------------------------
// SCSS compilation helper
// ---------------------------------------------------------------------------

function compileSass(srcGlob, destDir) {
  return src(srcGlob, { allowEmpty: true })
    .pipe(sourcemaps.init())
    .pipe(
      sass({
        loadPaths: [paths.partials],
        outputStyle: 'expanded',
      }).on('error', sass.logError)
    )
    .pipe(postcss([autoprefixer()]))
    .pipe(sourcemaps.write('.'))
    .pipe(dest(destDir));
}

// SDC: each component compiles in-place (hero.scss → hero.css same dir)
function compileSdc() {
  return src(paths.sdc.src, { allowEmpty: true, base: paths.sdc.dest })
    .pipe(sourcemaps.init())
    .pipe(
      sass({
        loadPaths: [paths.partials],
        outputStyle: 'expanded',
      }).on('error', sass.logError)
    )
    .pipe(postcss([autoprefixer()]))
    .pipe(sourcemaps.write('.'))
    .pipe(dest(paths.sdc.dest));
}

// ---------------------------------------------------------------------------
// JS helper
// ---------------------------------------------------------------------------

function processJs(srcGlob, destDir) {
  return src(srcGlob, { allowEmpty: true })
    .pipe(sourcemaps.init())
    .pipe(terser({ mangle: false }))
    .pipe(sourcemaps.write('.'))
    .pipe(dest(destDir));
}

// ---------------------------------------------------------------------------
// Individual tasks
// ---------------------------------------------------------------------------

function scssThemeBase() {
  return compileSass(paths.themeBase.src, paths.themeBase.dest);
}

function scssThemeComponents() {
  return compileSass(paths.themeComponents.src, paths.themeComponents.dest);
}

function scssSdc() {
  return compileSdc();
}

function jsTheme() {
  return processJs(paths.themeJs.src, paths.themeJs.dest);
}

// ---------------------------------------------------------------------------
// Drupal cache clear (only css/js aggregation — fast)
// ---------------------------------------------------------------------------

function clearCache(done) {
  exec('ddev drush cc css-js 2>/dev/null || ddev drush cr', (err, stdout, stderr) => {
    if (stdout) console.log(stdout.trim());
    if (stderr && !stderr.includes('deprecated')) console.error(stderr.trim());
    done();
  });
}

// ---------------------------------------------------------------------------
// Watch
// ---------------------------------------------------------------------------

function watchFiles() {
  // Theme SCSS
  watch(
    [`${THEME}/scss/base/**/*.scss`, `${THEME}/scss/_*.scss`],
    series(scssThemeBase, clearCache)
  );
  watch(
    [`${THEME}/scss/components/**/*.scss`, `${THEME}/scss/_*.scss`],
    series(scssThemeComponents, clearCache)
  );

  // SDC SCSS
  watch(
    [`${THEME}/components/**/*.scss`, `${THEME}/scss/_*.scss`],
    series(scssSdc, clearCache)
  );

  // Theme JS
  watch(paths.themeJs.src, series(jsTheme, clearCache));

  console.log('\n  👀 Watching for changes… (Ctrl+C to stop)\n');
}

// ---------------------------------------------------------------------------
// Composite tasks
// ---------------------------------------------------------------------------

const buildScss = parallel(scssThemeBase, scssThemeComponents, scssSdc);
const buildJs = parallel(jsTheme);
const build = parallel(buildScss, buildJs);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

exports.build = build;
exports.watch = series(build, watchFiles);
exports.default = build;

// Granular exports for debugging
exports['scss:base'] = scssThemeBase;
exports['scss:components'] = scssThemeComponents;
exports['scss:sdc'] = scssSdc;
exports['js:theme'] = jsTheme;
exports.clearCache = clearCache;
