using backend;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSingleton<Service>();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseCors();

// Sztuczne opóźnienie każdego endpointu, żeby na froncie było widać ładowanie.
// Ustawiane w appsettings.json ("ApiDelayMs"), 0 je wyłącza.
var delay = app.Configuration.GetValue("ApiDelayMs", 1000);
app.Use(async (context, next) =>
{
    if (delay > 0)
        await Task.Delay(delay, context.RequestAborted);

    await next(context);
});

app.MapControllers();

app.Run();
