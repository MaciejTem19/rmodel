using Microsoft.AspNetCore.Mvc;

namespace backend;

[ApiController]
[Route("/")]
public class Controller(Service service) : ControllerBase
{
    //Pobieranie usera
    [HttpGet("user/{id:int}")]
    public ActionResult<UserDTO> GetUser(int id)
    {
        var user = service.GetUser(id);
        return user is null ? NotFound() : Ok(user);
    }

    //Pobieranie wszystkich kart danego usera
    [HttpGet]
    public ActionResult<IReadOnlyList<CardDTO>> GetAll([FromQuery] int userId) => Ok(service.GetAll(userId));

    //Pobieranie textu dla pojedynczego
    [HttpGet("{id:int}/text")]
    public ActionResult<string> GetText(int id)
    {
        var text = service.GetText(id);
        return text is null ? NotFound() : Ok(text);
    }

    //Endpoint z pobieraniem zdjęcia
    [HttpGet("{id:int}/image")]
    public IActionResult GetImage(int id)
    {
        var image = service.GetImage(id);
        return image is null ? NotFound() : File(image, DetectContentType(image));
    }

    //Dodawanie nowego
    [HttpPost]
    public async Task<ActionResult<CardDTO>> Add([FromForm] CreateCardRequest request)
    {
        using var stream = new MemoryStream();
        await request.Image.CopyToAsync(stream);

        var card = service.Add(request.UserId, request.Title, request.Text, stream.ToArray());
        return CreatedAtAction(nameof(GetText), new { id = card.Id }, card);
    }

    //Usuwanie danego
    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id) => service.Delete(id) ? NoContent() : NotFound();

    //Edycja textu
    [HttpPatch("{id:int}/text")]
    public ActionResult<CardDTO> UpdateText(int id, UpdateTextRequest request)
    {
        var card = service.UpdateText(id, request.Text);
        return card is null ? NotFound() : Ok(card);
    }

    //Edycja nazwy
    [HttpPatch("{id:int}/title")]
    public ActionResult<CardDTO> UpdateTitle(int id, UpdateTitleRequest request)
    {
        var card = service.UpdateTitle(id, request.Title);
        return card is null ? NotFound() : Ok(card);
    }

    private static string DetectContentType(byte[] data) => data switch
    {
        [0x89, 0x50, 0x4E, 0x47, ..] => "image/png",
        [0xFF, 0xD8, 0xFF, ..] => "image/jpeg",
        [0x47, 0x49, 0x46, ..] => "image/gif",
        [0x52, 0x49, 0x46, 0x46, _, _, _, _, 0x57, 0x45, 0x42, 0x50, ..] => "image/webp",
        [(byte)'<', ..] => "image/svg+xml",
        _ => "application/octet-stream",
    };
}

public class CreateCardRequest
{
    public required int UserId { get; init; }
    public required string Title { get; init; }
    public required string Text { get; init; }
    public required IFormFile Image { get; init; }
}

public record UpdateTextRequest(string Text);

public record UpdateTitleRequest(string Title);

public record CardDTO(
    string Title,
    int Id,
    DateTime CreatedAt,
    DateTime? LastClicked
    // byte[] Image
);

public record UserDTO(string Nick, string Code);

public record User(int Id, string Nick, string Code);

public record Card(
    int Id,
    int UserId,
    string Title,
    DateTime CreatedAt,
    DateTime? LastClicked,
    byte[] Image,
    string Text
);
