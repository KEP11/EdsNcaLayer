using EdsWebApi.Services;
using NKalkan;

var builder = WebApplication.CreateBuilder(args);

// Configure URLs
builder.WebHost.UseUrls("http://localhost:5000");

// Configure Kestrel to allow larger request bodies
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 100_000_000; // 100MB
});

// Controllers
builder.Services.AddControllers();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "https://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Services
builder.Services.AddScoped<DocumentSignService>(); // KalkanAPI document signing service

var app = builder.Build();

// CORS must be used early in the pipeline, before other middlewares
app.UseCors("AllowLocalhost");

// Swagger
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "EdsNcaLayer API v1");
    c.RoutePrefix = string.Empty; // serve UI at root
});

// HTTPS redirection (optional - disable for testing in development)
// app.UseHttpsRedirection();

app.MapControllers();
app.Run();